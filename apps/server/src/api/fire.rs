use crate::{error::ApiResult, main_lib::AppState};
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use diesel::deserialize::QueryableByName;
use diesel::prelude::*;
use diesel::sql_types::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// ── Router ────────────────────────────────────────────────────────────────────
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/fire/data", get(get_fire_data))
        .route("/fire/settings", post(save_fire_settings))
        .route("/fire/settings", get(get_fire_settings))
}

// ── Models ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct FireSettings {
    pub monthly_expenses: f64,
    pub monthly_income_override: Option<f64>,
    pub inps_monthly: f64,
    pub fire_number: Option<f64>,
    pub annual_return_rate: f64,
    pub inflation_rate: f64,
    pub current_age: Option<i32>,
    pub target_fire_age: Option<i32>,
}

impl Default for FireSettings {
    fn default() -> Self {
        Self {
            monthly_expenses: 2000.0,
            monthly_income_override: None,
            inps_monthly: 0.0,
            fire_number: None,
            annual_return_rate: 0.07,
            inflation_rate: 0.025,
            current_age: None,
            target_fire_age: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RunwayScenario {
    pub label: String,
    pub months: f64,
    pub description: String,
}

#[derive(Debug, Serialize)]
pub struct FireScenario {
    pub label: String,
    pub monthly_target: f64,
    pub fire_number: f64,
    pub months_to_fire: Option<f64>,
    pub years_to_fire: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct NetWorthPoint {
    pub date: String,
    pub total_value: f64,
}

#[derive(Debug, Serialize)]
pub struct FireData {
    pub net_worth: f64,
    pub avg_monthly_expenses: f64,
    pub avg_monthly_income: f64,
    pub avg_monthly_savings: f64,
    pub savings_rate: f64,
    pub freedom_score: f64,
    pub runway_scenarios: Vec<RunwayScenario>,
    pub fire_scenarios: Vec<FireScenario>,
    pub net_worth_history: Vec<NetWorthPoint>,
    pub settings: FireSettings,
}

#[derive(Debug, QueryableByName)]
struct MonthlyBudget {
    #[diesel(sql_type = Nullable<Text>)]
    month: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    tx_type: Option<String>,
    #[diesel(sql_type = Nullable<Double>)]
    total: Option<f64>,
}

#[derive(Debug, QueryableByName)]
struct AccountValuation {
    #[diesel(sql_type = Text)]
    account_id: String,
    #[diesel(sql_type = Text)]
    valuation_date: String,
    #[diesel(sql_type = Text)]
    total_value: String,
}

#[derive(Debug, QueryableByName)]
struct SettingsRow {
    #[diesel(sql_type = Text)]
    value: String,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn months_to_fire(
    net_worth: f64,
    monthly_savings: f64,
    fire_number: f64,
    annual_return: f64,
) -> Option<f64> {
    if fire_number <= 0.0 || net_worth >= fire_number {
        return Some(0.0);
    }
    if monthly_savings <= 0.0 {
        return None;
    }
    let r = annual_return / 12.0;
    if r == 0.0 {
        return Some((fire_number - net_worth) / monthly_savings);
    }
    let fv = fire_number - net_worth;
    let numerator = (fv * r + monthly_savings) / monthly_savings;
    if numerator <= 0.0 {
        return None;
    }
    let n = numerator.ln() / (1.0 + r).ln();
    if n < 0.0 {
        None
    } else {
        Some(n)
    }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn get_fire_settings(State(state): State<Arc<AppState>>) -> ApiResult<Json<FireSettings>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    let result = diesel::sql_query(
        "SELECT setting_value as value FROM app_settings WHERE setting_key = 'fire_settings' LIMIT 1",
    )
    .load::<SettingsRow>(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    if !result.is_empty() {
        let settings: FireSettings = serde_json::from_str(&result[0].value).unwrap_or_default();
        Ok(Json(settings))
    } else {
        Ok(Json(FireSettings::default()))
    }
}

async fn save_fire_settings(
    State(state): State<Arc<AppState>>,
    Json(settings): Json<FireSettings>,
) -> ApiResult<Json<FireSettings>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    let json =
        serde_json::to_string(&settings).map_err(|e| anyhow::anyhow!("Serialize error: {}", e))?;

    diesel::sql_query(
        "INSERT INTO app_settings (setting_key, setting_value) VALUES ('fire_settings', ?)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value",
    )
    .bind::<Text, _>(&json)
    .execute(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    Ok(Json(settings))
}

async fn get_fire_data(State(state): State<Arc<AppState>>) -> ApiResult<Json<FireData>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    // ── Load settings ─────────────────────────────────────────────────────────
    let settings_rows = diesel::sql_query(
        "SELECT setting_value as value FROM app_settings WHERE setting_key = 'fire_settings' LIMIT 1",
    )
    .load::<SettingsRow>(&mut conn)
    .unwrap_or_default();

    let settings: FireSettings = if !settings_rows.is_empty() {
        serde_json::from_str(&settings_rows[0].value).unwrap_or_default()
    } else {
        FireSettings::default()
    };

    // ── Budget data (last 12 months average) ──────────────────────────────────
    let budget_rows = diesel::sql_query(
        "SELECT strftime('%Y-%m', date) as month, type as tx_type, SUM(amount) as total
         FROM budget_transactions
         WHERE date >= date('now', '-12 months')
         GROUP BY month, type
         ORDER BY month DESC",
    )
    .load::<MonthlyBudget>(&mut conn)
    .unwrap_or_default();

    let mut monthly_income: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();
    let mut monthly_expenses_map: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();

    for row in &budget_rows {
        let month = row.month.clone().unwrap_or_default();
        let total = row.total.unwrap_or(0.0);
        match row.tx_type.as_deref() {
            Some("income") => {
                monthly_income.insert(month, total);
            }
            Some("expense") => {
                monthly_expenses_map.insert(month, total);
            }
            _ => {}
        }
    }

    let avg_monthly_income_from_budget = if monthly_income.is_empty() {
        settings.monthly_expenses * 1.5
    } else {
        monthly_income.values().sum::<f64>() / monthly_income.len() as f64
    };

    // Use manual override if set
    let avg_monthly_income = settings
        .monthly_income_override
        .unwrap_or(avg_monthly_income_from_budget);

    let avg_monthly_expenses_db = if monthly_expenses_map.is_empty() {
        settings.monthly_expenses
    } else {
        monthly_expenses_map.values().sum::<f64>() / monthly_expenses_map.len() as f64
    };

    let avg_monthly_expenses = settings.monthly_expenses;
    let avg_monthly_savings = avg_monthly_income - avg_monthly_expenses_db;
    let savings_rate = if avg_monthly_income > 0.0 {
        (avg_monthly_savings / avg_monthly_income * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    // ── Net Worth (latest valuation) ──────────────────────────────────────────
    let valuation_rows = diesel::sql_query(
        "SELECT account_id, valuation_date, total_value
         FROM daily_account_valuation
         WHERE valuation_date = (SELECT MAX(valuation_date) FROM daily_account_valuation)",
    )
    .load::<AccountValuation>(&mut conn)
    .unwrap_or_default();

    let net_worth: f64 = valuation_rows
        .iter()
        .map(|r| r.total_value.parse::<f64>().unwrap_or(0.0))
        .sum();

    // ── Net Worth History (one point per month) ────────────────────────────────
    let history_rows = diesel::sql_query(
        "SELECT account_id, valuation_date, total_value
         FROM daily_account_valuation
         WHERE valuation_date IN (
           SELECT MAX(valuation_date)
           FROM daily_account_valuation
           GROUP BY strftime('%Y-%m', valuation_date)
         )
         ORDER BY valuation_date ASC",
    )
    .load::<AccountValuation>(&mut conn)
    .unwrap_or_default();

    let mut history_map: std::collections::BTreeMap<String, f64> =
        std::collections::BTreeMap::new();
    for row in &history_rows {
        let val = row.total_value.parse::<f64>().unwrap_or(0.0);
        *history_map.entry(row.valuation_date.clone()).or_insert(0.0) += val;
    }

    let net_worth_history: Vec<NetWorthPoint> = history_map
        .into_iter()
        .map(|(date, total_value)| NetWorthPoint { date, total_value })
        .collect();

    // ── FIRE Number ───────────────────────────────────────────────────────────
    let fire_number = settings
        .fire_number
        .unwrap_or(avg_monthly_expenses * 12.0 * 25.0);

    // ── Freedom Score ─────────────────────────────────────────────────────────
    let freedom_score = if fire_number > 0.0 {
        ((net_worth / fire_number) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    // ── Runway Scenarios ──────────────────────────────────────────────────────
    let runway_no_income = if avg_monthly_expenses > 0.0 {
        net_worth / avg_monthly_expenses
    } else {
        0.0
    };
    let monthly_with_inps = avg_monthly_expenses - settings.inps_monthly;
    let runway_with_inps = if monthly_with_inps > 0.0 {
        net_worth / monthly_with_inps
    } else {
        f64::MAX
    };
    let annual_return = settings.annual_return_rate;
    let monthly_passive = (net_worth * annual_return) / 12.0;
    let runway_passive = if avg_monthly_expenses > monthly_passive {
        net_worth / (avg_monthly_expenses - monthly_passive)
    } else {
        f64::MAX
    };

    let runway_scenarios = vec![
        RunwayScenario {
            label: "Capital only".to_string(),
            months: runway_no_income,
            description: "Months of freedom with no income".to_string(),
        },
        RunwayScenario {
            label: "With INPS".to_string(),
            months: if runway_with_inps >= f64::MAX {
                9999.0
            } else {
                runway_with_inps
            },
            description: format!("With unemployment benefit €{:.0}/mo", settings.inps_monthly),
        },
        RunwayScenario {
            label: "With returns".to_string(),
            months: if runway_passive >= f64::MAX {
                9999.0
            } else {
                runway_passive
            },
            description: format!(
                "Including investment returns ({:.0}%/yr)",
                annual_return * 100.0
            ),
        },
    ];

    // ── FIRE Scenarios ────────────────────────────────────────────────────────
    let lean_expenses = avg_monthly_expenses * 0.7;
    let fat_expenses = avg_monthly_expenses * 1.5;

    let make_scenario = |label: &str, monthly: f64| {
        let fn_val = monthly * 12.0 * 25.0;
        let mtf = months_to_fire(
            net_worth,
            avg_monthly_savings.max(0.0),
            fn_val,
            annual_return,
        );
        FireScenario {
            label: label.to_string(),
            monthly_target: monthly,
            fire_number: fn_val,
            months_to_fire: mtf,
            years_to_fire: mtf.map(|m| m / 12.0),
        }
    };

    let fire_scenarios = vec![
        make_scenario("Lean FIRE", lean_expenses),
        make_scenario("Regular FIRE", avg_monthly_expenses),
        make_scenario("Fat FIRE", fat_expenses),
    ];

    Ok(Json(FireData {
        net_worth,
        avg_monthly_expenses,
        avg_monthly_income,
        avg_monthly_savings,
        savings_rate,
        freedom_score,
        runway_scenarios,
        fire_scenarios,
        net_worth_history,
        settings,
    }))
}
