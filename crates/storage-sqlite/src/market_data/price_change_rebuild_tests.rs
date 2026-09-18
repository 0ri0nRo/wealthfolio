use std::future::Future;

use wealthfolio_core::{
    accounts::AccountService,
    events::NoOpDomainEventSink,
    fx::FxService,
    portfolio::{
        price_change_rebuild::rebuild_portfolio_after_price_changes, snapshot::SnapshotService,
        valuation::ValuationService,
    },
    quotes::{QuoteService, QuoteServiceTrait},
};

struct RebuildFixture {
    repo: Arc<MarketDataRepository>,
    quotes: Arc<dyn QuoteServiceTrait>,
    accounts: AccountService,
    snapshots: Arc<SnapshotService>,
    valuations: ValuationService,
    fx: Arc<FxService>,
    gate: Arc<wealthfolio_core::portfolio::recalculation_gate::PortfolioRecalculationGate>,
    _temp: tempfile::TempDir,
}
impl RebuildFixture {
    async fn new() -> Self {
        let (repo, temp) = create_test_repository().await;
        insert_test_asset(&repo, "REBUILD");
        let date = Utc::now().date_naive() - chrono::Duration::days(2);
        let mut conn = get_connection(&repo.pool).unwrap();
        diesel::sql_query("UPDATE market_data_providers SET enabled=0")
            .execute(&mut conn)
            .unwrap();
        for id in ["successful-account", "failed-account"] {
            diesel::sql_query(format!("INSERT INTO accounts (id,name,account_type,currency,is_default,is_active,created_at,updated_at) VALUES ('{id}','Rebuild test','SECURITIES','USD',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
                .execute(&mut conn).unwrap();
            diesel::sql_query(format!("INSERT INTO activities (id,account_id,asset_id,activity_type,activity_date,quantity,unit_price,currency,created_at,updated_at) VALUES ('{id}-buy','{id}','REBUILD','BUY','{date}T12:00:00Z','1','1','USD',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
                .execute(&mut conn).unwrap();
        }
        drop(conn);
        repo.upsert_quotes_for_refresh(&[quote_with_source(
            "REBUILD",
            date,
            "YAHOO",
            Decimal::TEN,
        )])
        .await
        .unwrap();
        let repo = Arc::new(repo);
        let assets = Arc::new(crate::assets::AssetRepository::new(
            repo.pool.clone(),
            repo.writer.clone(),
        ));
        let activities = Arc::new(crate::activities::ActivityRepository::new(
            repo.pool.clone(),
            repo.writer.clone(),
        ));
        let account_repo = Arc::new(crate::accounts::AccountRepository::new(
            repo.pool.clone(),
            repo.writer.clone(),
        ));
        let sync_states = Arc::new(crate::market_data::QuoteSyncStateRepository::new(
            repo.pool.clone(),
            repo.writer.clone(),
        ));
        let fx = Arc::new(FxService::new(Arc::new(crate::fx::FxRepository::new(
            repo.pool.clone(),
            repo.writer.clone(),
        ))));
        let base_currency = Arc::new(std::sync::RwLock::new("USD".to_owned()));
        let quotes: Arc<dyn QuoteServiceTrait> = Arc::new(
            QuoteService::new(
                repo.clone(),
                sync_states.clone(),
                repo.clone(),
                assets.clone(),
                activities.clone(),
                Arc::new(NoSecrets),
            )
            .await
            .unwrap(),
        );
        let accounts = AccountService::new(
            account_repo.clone(),
            fx.clone(),
            base_currency.clone(),
            Arc::new(NoOpDomainEventSink),
            assets.clone(),
            sync_states,
        );
        let gate = Arc::new(
            wealthfolio_core::portfolio::recalculation_gate::PortfolioRecalculationGate::default(),
        );
        let snapshots = Arc::new(
            SnapshotService::new(
                base_currency.clone(),
                account_repo,
                activities,
                Arc::new(crate::portfolio::snapshot::SnapshotRepository::new(
                    repo.pool.clone(),
                    repo.writer.clone(),
                )),
                assets,
                fx.clone(),
            )
            .with_recalculation_gate(gate.clone()),
        );
        let valuations = ValuationService::new(
            base_currency,
            Arc::new(crate::portfolio::valuation::ValuationRepository::new(
                repo.pool.clone(),
                repo.writer.clone(),
            )),
            snapshots.clone(),
            quotes.clone(),
            fx.clone(),
        );

        Self {
            repo,
            quotes,
            accounts,
            snapshots,
            valuations,
            fx,
            gate,
            _temp: temp,
        }
    }
    async fn rebuild(&self) -> Result<bool> {
        rebuild_portfolio_after_price_changes(
            self.quotes.as_ref(),
            &self.accounts,
            self.snapshots.as_ref(),
            &self.valuations,
            self.fx.as_ref(),
        )
        .await
    }
    fn sql(&self, sql: &str) {
        diesel::sql_query(sql)
            .execute(&mut get_connection(&self.repo.pool).unwrap())
            .unwrap();
    }
}
#[tokio::test]
async fn portfolio_rebuild_preserves_pending_on_partial_failure_then_recovers() {
    let fixture = RebuildFixture::new().await;
    let RebuildFixture {
        ref repo,
        ref quotes,
        ref accounts,
        ref snapshots,
        ref valuations,
        ref fx,
        ..
    } = fixture;
    let mut conn = get_connection(&repo.pool).unwrap();
    diesel::sql_query("CREATE TRIGGER fail_one_valuation BEFORE INSERT ON daily_account_valuation WHEN NEW.account_id='failed-account' BEGIN SELECT RAISE(ABORT, 'injected valuation failure'); END")
            .execute(&mut conn).unwrap();
    drop(conn);
    let token = repo.pending_portfolio_rebuild_token().unwrap().unwrap();
    let result = rebuild_portfolio_after_price_changes(
        quotes.as_ref(),
        accounts,
        snapshots.as_ref(),
        valuations,
        fx.as_ref(),
    )
    .await;
    assert!(result.is_err());
    assert_eq!(
        repo.pending_portfolio_rebuild_token().unwrap().as_deref(),
        Some(token.as_str())
    );
    use crate::schema::daily_account_valuation::dsl as valuation_dsl;
    let mut conn = get_connection(&repo.pool).unwrap();
    let count: i64 = valuation_dsl::daily_account_valuation
        .filter(valuation_dsl::account_id.eq("successful-account"))
        .count()
        .get_result(&mut conn)
        .unwrap();
    assert!(
        count > 0,
        "Successful accounts must commit despite another account's failure"
    );
    diesel::sql_query("DROP TRIGGER fail_one_valuation")
        .execute(&mut conn)
        .unwrap();
    drop(conn);
    assert!(rebuild_portfolio_after_price_changes(
        quotes.as_ref(),
        accounts,
        snapshots.as_ref(),
        valuations,
        fx.as_ref()
    )
    .await
    .unwrap());
    assert!(repo.pending_portfolio_rebuild_token().unwrap().is_none());
    assert!(!rebuild_portfolio_after_price_changes(
        quotes.as_ref(),
        accounts,
        snapshots.as_ref(),
        valuations,
        fx.as_ref()
    )
    .await
    .unwrap());
}

#[tokio::test]
async fn price_change_during_calculation_gets_a_second_pass() {
    let fixture = RebuildFixture::new().await;
    fixture.sql("CREATE TABLE rebuild_passes (id INTEGER PRIMARY KEY)");
    fixture.sql("CREATE TRIGGER record_rebuild_pass AFTER INSERT ON daily_account_valuation WHEN NEW.account_id='successful-account' AND NEW.valuation_date=(SELECT min(substr(activity_date,1,10)) FROM activities) BEGIN INSERT INTO rebuild_passes VALUES (NULL); END");
    fixture.sql("CREATE TRIGGER change_price_once AFTER INSERT ON daily_account_valuation WHEN (SELECT close FROM quotes WHERE asset_id='REBUILD')='10' BEGIN UPDATE quotes SET close='11' WHERE asset_id='REBUILD'; END");
    assert!(fixture.rebuild().await.unwrap());
    assert!(fixture
        .repo
        .pending_portfolio_rebuild_token()
        .unwrap()
        .is_none());
    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = diesel::sql_types::BigInt)]
        count: i64,
    }
    let count: Count = diesel::sql_query("SELECT count(*) AS count FROM rebuild_passes")
        .get_result(&mut get_connection(&fixture.repo.pool).unwrap())
        .unwrap();
    assert_eq!(
        count.count, 2,
        "A newer price token must force a second pass"
    );
}

#[tokio::test]
async fn continuously_changing_prices_stop_after_two_passes_and_can_retry() {
    let fixture = RebuildFixture::new().await;
    fixture.sql("CREATE TABLE rebuild_passes (id INTEGER PRIMARY KEY)");
    fixture.sql("CREATE TRIGGER record_rebuild_pass AFTER INSERT ON daily_account_valuation WHEN NEW.account_id='successful-account' AND NEW.valuation_date=(SELECT min(substr(activity_date,1,10)) FROM activities) BEGIN INSERT INTO rebuild_passes VALUES (NULL); END");
    fixture.sql("CREATE TRIGGER change_price_always AFTER INSERT ON daily_account_valuation BEGIN UPDATE quotes SET close=CAST(close AS REAL)+1 WHERE asset_id='REBUILD'; END");
    assert!(fixture.rebuild().await.is_err());
    assert!(fixture
        .repo
        .pending_portfolio_rebuild_token()
        .unwrap()
        .is_some());
    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = diesel::sql_types::BigInt)]
        count: i64,
    }
    let count: Count = diesel::sql_query("SELECT count(*) AS count FROM rebuild_passes")
        .get_result(&mut get_connection(&fixture.repo.pool).unwrap())
        .unwrap();
    assert_eq!(
        count.count, 2,
        "Concurrent writes must not cause an unbounded rebuild loop"
    );
    fixture.sql("DROP TRIGGER change_price_always");
    assert!(fixture.rebuild().await.unwrap());
    assert!(fixture
        .repo
        .pending_portfolio_rebuild_token()
        .unwrap()
        .is_none());
}

#[tokio::test]
async fn cancelled_calculation_retains_token_and_next_attempt_completes() {
    let fixture = RebuildFixture::new().await;
    let token = fixture.repo.pending_portfolio_rebuild_token().unwrap();
    let permit = fixture
        .gate
        .acquire(&["successful-account".into(), "failed-account".into()])
        .await;
    let mut calculation = Box::pin(fixture.rebuild());
    // Poll the actual helper into its first async calculation while the existing
    // account gate prevents it from completing. Dropping simulates interruption.
    assert!(
        std::future::poll_fn(|cx| {
            std::task::Poll::Ready(calculation.as_mut().poll(cx).is_pending())
        })
        .await
    );
    drop(calculation);
    assert_eq!(
        fixture.repo.pending_portfolio_rebuild_token().unwrap(),
        token
    );
    drop(permit);
    assert!(fixture.rebuild().await.unwrap());
    assert!(fixture
        .repo
        .pending_portfolio_rebuild_token()
        .unwrap()
        .is_none());
    assert!(
        !fixture.rebuild().await.unwrap(),
        "Repeated requests after completion must do no work"
    );
}

#[tokio::test]
async fn rebuild_requests_notify_only_while_pending() {
    use wealthfolio_core::{
        events::{DomainEvent, MockDomainEventSink},
        portfolio::price_change_rebuild::request_portfolio_rebuild_after_price_changes,
    };
    let fixture = RebuildFixture::new().await;
    let sink = MockDomainEventSink::new();
    for _ in 0..3 {
        assert!(request_portfolio_rebuild_after_price_changes(
            fixture.quotes.as_ref(),
            &sink
        ));
    }
    assert_eq!(sink.len(), 3);
    assert!(sink
        .events()
        .iter()
        .all(|event| matches!(event, DomainEvent::PriceHistoryChanged)));
    assert!(fixture.rebuild().await.unwrap());
    assert!(!request_portfolio_rebuild_after_price_changes(
        fixture.quotes.as_ref(),
        &sink
    ));
    assert_eq!(
        sink.len(),
        3,
        "A completed rebuild must not enqueue more work"
    );
}
