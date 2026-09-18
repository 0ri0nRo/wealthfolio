//! Portfolio recalculation after committed price changes.

use crate::events::{DomainEvent, DomainEventSink};

use crate::accounts::AccountServiceTrait;
use crate::fx::FxServiceTrait;
use crate::quotes::QuoteServiceTrait;
use crate::{Error, Result};

use super::snapshot::{
    reconcile_quote_sync_from_latest_account_snapshots, SnapshotRecalcMode, SnapshotServiceTrait,
};
use super::valuation::{ValuationBatchOutcome, ValuationRecalcMode, ValuationServiceTrait};

// One worker processes each runtime's event batches. Limit extra work when prices
// keep changing; the durable marker remains for the next job or startup.
const MAX_REBUILD_PASSES: usize = 2;

/// Notify the existing debounced worker only when committed prices need rebuilding.
/// This is also used at startup, after the worker has been installed.
pub fn request_portfolio_rebuild_after_price_changes(
    quotes: &dyn QuoteServiceTrait,
    events: &dyn DomainEventSink,
) -> bool {
    match quotes.pending_portfolio_rebuild_token() {
        Ok(Some(_)) => {
            events.emit(DomainEvent::PriceHistoryChanged);
            true
        }
        Ok(None) => false,
        Err(error) => {
            log::warn!("Unable to check pending portfolio rebuild: {error}");
            false
        }
    }
}

/// Rebuild without another market fetch. A failed attempt leaves its durable token
/// intact. Retry once if prices change during calculation; otherwise keep pending work.
pub async fn rebuild_portfolio_after_price_changes(
    quotes: &dyn QuoteServiceTrait,
    accounts: &dyn AccountServiceTrait,
    snapshots: &dyn SnapshotServiceTrait,
    valuations: &dyn ValuationServiceTrait,
    fx: &dyn FxServiceTrait,
) -> Result<bool> {
    let mut rebuilt = false;
    for _ in 0..MAX_REBUILD_PASSES {
        let Some(token) = quotes.pending_portfolio_rebuild_token()? else {
            return Ok(rebuilt);
        };
        // Provider history is shared by archived accounts too; their own historical
        // valuations must be rebuilt even though they remain outside portfolio scope.
        let all_accounts = accounts.get_all_accounts()?;
        let reconciliation_ids: Vec<String> = all_accounts
            .iter()
            .filter(|account| !account.is_archived)
            .map(|account| account.id.clone())
            .collect();
        let account_ids: Vec<String> = all_accounts.into_iter().map(|account| account.id).collect();
        fx.initialize()?;
        if !account_ids.is_empty() {
            snapshots
                .recalculate_holdings_snapshots(Some(&account_ids), SnapshotRecalcMode::Full)
                .await?;
            if let Err(error) = reconcile_quote_sync_from_latest_account_snapshots(
                snapshots,
                quotes,
                &reconciliation_ids,
            )
            .await
            {
                log::warn!(
                    "Quote sync state reconciliation after rebuild failed: {}",
                    error
                );
            }
            let outcome = valuations
                .calculate_valuation_histories(&account_ids, ValuationRecalcMode::Full)
                .await?;
            if !all_accounts_rebuilt(&account_ids, &outcome) {
                return Err(Error::Unexpected(
                    "Quote history is saved, but portfolio recalculation remains pending.".into(),
                ));
            }
        }
        rebuilt = true;
        if quotes
            .clear_pending_portfolio_rebuild_if_token_matches(&token)
            .await?
        {
            return Ok(true);
        }
    }
    Err(Error::Unexpected(
        "Prices changed during calculation; portfolio rebuild remains pending for the next update or restart.".into(),
    ))
}

fn all_accounts_rebuilt(account_ids: &[String], outcome: &ValuationBatchOutcome) -> bool {
    outcome.failures.is_empty()
        && account_ids
            .iter()
            .all(|id| outcome.successful_accounts.contains(id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_account_is_not_acknowledged() {
        let accounts = vec!["a".into(), "b".into()];
        let mut outcome = ValuationBatchOutcome {
            successful_accounts: vec!["a".into(), "a".into()],
            ..Default::default()
        };
        assert!(!all_accounts_rebuilt(&accounts, &outcome));
        outcome.successful_accounts.push("b".into());
        assert!(all_accounts_rebuilt(&accounts, &outcome));
    }

    #[test]
    fn partial_failure_does_not_acknowledge_complete_success_list() {
        let accounts = vec!["a".into()];
        let outcome = ValuationBatchOutcome {
            successful_accounts: accounts.clone(),
            failures: vec![super::super::valuation::ValuationAccountFailure {
                account_id: "a".into(),
                code: "CALCULATION_FAILED".into(),
                message: "calculation failed".into(),
                date: None,
                min_date: None,
                max_date: None,
                snapshot_source: None,
            }],
        };
        assert!(!all_accounts_rebuilt(&accounts, &outcome));
    }

    #[test]
    fn no_accounts_requires_no_valuation_results() {
        assert!(all_accounts_rebuilt(&[], &ValuationBatchOutcome::default()));
    }
}
