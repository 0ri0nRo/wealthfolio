// tauri/src/commands/fire.rs
//
// Tauri command wrappers for FIRE data.
// The actual business logic lives in server/src/api/fire.rs (Axum).
// These commands expose the same data to the frontend via invoke().

use crate::context::ServiceContext;
use diesel::deserialize::QueryableByName;
use diesel::prelude::*;
use diesel::sql_types::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

// ── Models ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize)]
pub struct RunwayScenario {
    pub label: String,
    pub months: f64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FireScenario {
    pub label: String,
    pub monthly_target: f64,
    pub fire_number: f64,
    pub months_to_fire: Option<f64>,
    pub years_to_fire: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NetWorthPoint {
    pub date: String,
    pub total_value: f64,
}

#[derive(Debug, Clone, Serialize)]
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

// ── Internal DB row types ─────────────────────────────────────────────────────

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

fn load_settings(conn: &mut diesel::SqliteConnection) -> FireSettings {
    let rows = diesel::sql_query(
        "SELECT setting_value as value \
         FROM app_settings WHERE setting_key = 'fire_settings' LIMIT 1",
    )
    .load::<SettingsRow>(conn)
    .unwrap_or_default();

    rows.first()
        .and_then(|r| serde_json::from_str(&r.value).ok())
        .unwrap_or_default()
}

fn build_data(conn: &mut diesel::SqliteConnection, s: &FireSettings) -> FireData {
    // ── Budget averages (last 12 months) ──────────────────────────────────────
    let budget_rows = diesel::sql_query(
        "SELECT strftime('%Y-%m', date) as month, type as tx_type, SUM(amount) as total
         FROM budget_transactions
         WHERE date >= date('now', '-12 months')
         GROUP BY month, type",
    )
    .load::<MonthlyBudget>(conn)
    .unwrap_or_default();

    let mut inc_map: std::collections::HashMap<String, f64> = Default::default();
    let mut exp_map: std::collections::HashMap<String, f64> = Default::default();

    for row in &budget_rows {
        let month = row.month.clone().unwrap_or_default();
        let total = row.total.unwrap_or(0.0);
        match row.tx_type.as_deref() {
            Some("income") => {
                inc_map.insert(month, total);
            }
            Some("expense") => {
                exp_map.insert(month, total);
            }
            _ => {}
        }
    }

    let avg_inc_db = if inc_map.is_empty() {
        s.monthly_expenses * 1.5
    } else {
        inc_map.values().sum::<f64>() / inc_map.len() as f64
    };
    let avg_monthly_income = s.monthly_income_override.unwrap_or(avg_inc_db);
    let avg_monthly_expenses = s.monthly_expenses;
    let avg_exp_db = if exp_map.is_empty() {
        s.monthly_expenses
    } else {
        exp_map.values().sum::<f64>() / exp_map.len() as f64
    };
    let avg_monthly_savings = avg_monthly_income - avg_exp_db;
    let savings_rate = if avg_monthly_income > 0.0 {
        (avg_monthly_savings / avg_monthly_income * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    // ── Net Worth ─────────────────────────────────────────────────────────────
    let latest = diesel::sql_query(
        "SELECT account_id, valuation_date, total_value
         FROM daily_account_valuation
         WHERE valuation_date = (SELECT MAX(valuation_date) FROM daily_account_valuation)",
    )
    .load::<AccountValuation>(conn)
    .unwrap_or_default();

    let net_worth: f64 = latest
        .iter()
        .map(|r| r.total_value.parse::<f64>().unwrap_or(0.0))
        .sum();

    // ── Net Worth History ─────────────────────────────────────────────────────
    let hist_rows = diesel::sql_query(
        "SELECT account_id, valuation_date, total_value
         FROM daily_account_valuation
         WHERE valuation_date IN (
           SELECT MAX(valuation_date)
           FROM daily_account_valuation
           GROUP BY strftime('%Y-%m', valuation_date)
         )
         ORDER BY valuation_date ASC",
    )
    .load::<AccountValuation>(conn)
    .unwrap_or_default();

    let mut hist: std::collections::BTreeMap<String, f64> = Default::default();
    for r in &hist_rows {
        *hist.entry(r.valuation_date.clone()).or_insert(0.0) +=
            r.total_value.parse::<f64>().unwrap_or(0.0);
    }
    let net_worth_history = hist
        .into_iter()
        .map(|(date, total_value)| NetWorthPoint { date, total_value })
        .collect();

    // ── FIRE Number ───────────────────────────────────────────────────────────
    let fire_number = s.fire_number.unwrap_or(avg_monthly_expenses * 12.0 * 25.0);
    let freedom_score = if fire_number > 0.0 {
        ((net_worth / fire_number) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    // ── Runway Scenarios ──────────────────────────────────────────────────────
    let ar = s.annual_return_rate;
    let monthly_passive = (net_worth * ar) / 12.0;

    let runway_cap = if avg_monthly_expenses > 0.0 {
        net_worth / avg_monthly_expenses
    } else {
        0.0
    };
    let net_inps = avg_monthly_expenses - s.inps_monthly;
    let runway_inps = if net_inps > 0.0 {
        net_worth / net_inps
    } else {
        f64::MAX
    };
    let net_passive = avg_monthly_expenses - monthly_passive;
    let runway_pass = if net_passive > 0.0 {
        net_worth / net_passive
    } else {
        f64::MAX
    };

    let cap = |v: f64| if v >= f64::MAX { 9999.0 } else { v };

    let runway_scenarios = vec![
        RunwayScenario {
            label: "Capital only".into(),
            months: runway_cap,
            description: "Months of freedom with no income".into(),
        },
        RunwayScenario {
            label: "With INPS".into(),
            months: cap(runway_inps),
            description: format!("With unemployment benefit €{:.0}/mo", s.inps_monthly),
        },
        RunwayScenario {
            label: "With returns".into(),
            months: cap(runway_pass),
            description: format!("Including investment returns ({:.0}%/yr)", ar * 100.0),
        },
    ];

    // ── FIRE Scenarios ────────────────────────────────────────────────────────
    let make = |label: &str, monthly: f64| {
        let fn_val = monthly * 12.0 * 25.0;
        let mtf = months_to_fire(net_worth, avg_monthly_savings.max(0.0), fn_val, ar);
        FireScenario {
            label: label.into(),
            monthly_target: monthly,
            fire_number: fn_val,
            months_to_fire: mtf,
            years_to_fire: mtf.map(|m| m / 12.0),
        }
    };

    let fire_scenarios = vec![
        make("Lean FIRE", avg_monthly_expenses * 0.7),
        make("Regular FIRE", avg_monthly_expenses),
        make("Fat FIRE", avg_monthly_expenses * 1.5),
    ];

    FireData {
        net_worth,
        avg_monthly_expenses,
        avg_monthly_income,
        avg_monthly_savings,
        savings_rate,
        freedom_score,
        runway_scenarios,
        fire_scenarios,
        net_worth_history,
        settings: s.clone(),
    }
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_fire_data(context: State<'_, Arc<ServiceContext>>) -> Result<FireData, String> {
    let mut conn = context.pool.get().map_err(|e| format!("Pool error: {e}"))?;
    let settings = load_settings(&mut conn);
    Ok(build_data(&mut conn, &settings))
}

#[tauri::command]
pub async fn get_fire_settings(
    context: State<'_, Arc<ServiceContext>>,
) -> Result<FireSettings, String> {
    let mut conn = context.pool.get().map_err(|e| format!("Pool error: {e}"))?;
    Ok(load_settings(&mut conn))
}

#[tauri::command]
pub async fn save_fire_settings(
    context: State<'_, Arc<ServiceContext>>,
    settings: FireSettings,
) -> Result<FireSettings, String> {
    let mut conn = context.pool.get().map_err(|e| format!("Pool error: {e}"))?;

    let json = serde_json::to_string(&settings).map_err(|e| format!("Serialize error: {e}"))?;

    diesel::sql_query(
        "INSERT INTO app_settings (setting_key, setting_value) VALUES ('fire_settings', ?)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value",
    )
    .bind::<Text, _>(&json)
    .execute(&mut conn)
    .map_err(|e| format!("DB error: {e}"))?;

    Ok(settings)
}
