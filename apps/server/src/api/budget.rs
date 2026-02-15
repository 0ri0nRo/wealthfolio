use crate::{error::ApiResult, main_lib::AppState};
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use diesel::deserialize::QueryableByName;
use diesel::prelude::*;
use diesel::sql_types::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, QueryableByName)]
pub struct BudgetCategory {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[serde(rename = "type")]
    #[diesel(sql_type = Text, column_name = "type")]
    pub category_type: String,
    #[diesel(sql_type = Text)]
    pub color: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub icon: Option<String>,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub parent_id: Option<i64>,
    #[diesel(sql_type = Bool)]
    pub is_active: bool,
    #[diesel(sql_type = Text)]
    pub created_at: String,
    #[diesel(sql_type = Text)]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetTransaction {
    pub id: Option<i64>,
    pub category_id: i64,
    pub amount: f64,
    #[serde(rename = "type")]
    pub transaction_type: String,
    pub description: String,
    pub date: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetSummary {
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
}

#[derive(Debug, Deserialize)]
struct TransactionQuery {
    month: u32,
    year: i32,
}

async fn get_categories(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Vec<BudgetCategory>>> {
    let mut conn = state.pool.get().map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    let categories: Vec<BudgetCategory> = diesel::sql_query(
        "SELECT id, name, type, color, icon, parent_id, is_active, created_at, updated_at
         FROM budget_categories
         WHERE is_active = 1
         ORDER BY name",
    )
    .load(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    Ok(Json(categories))
}

async fn get_summary(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TransactionQuery>,
) -> ApiResult<Json<BudgetSummary>> {
    let mut conn = state.pool.get().map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    let start_date = format!("{:04}-{:02}-01", query.year, query.month);
    let end_date = if query.month == 12 {
        format!("{:04}-01-01", query.year + 1)
    } else {
        format!("{:04}-{:02}-01", query.year, query.month + 1)
    };

    #[derive(QueryableByName)]
    struct TypeTotal {
        #[diesel(sql_type = Text, column_name = "type")]
        transaction_type: String,
        #[diesel(sql_type = Double)]
        total: f64,
    }

    let totals: Vec<TypeTotal> = diesel::sql_query(
        "SELECT type, SUM(amount) as total
         FROM budget_transactions
         WHERE date >= ? AND date < ?
         GROUP BY type",
    )
    .bind::<Text, _>(&start_date)
    .bind::<Text, _>(&end_date)
    .load(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    let mut total_income = 0.0;
    let mut total_expenses = 0.0;

    for row in totals {
        match row.transaction_type.as_str() {
            "income" => total_income = row.total,
            "expense" => total_expenses = row.total,
            _ => {}
        }
    }

    Ok(Json(BudgetSummary {
        total_income,
        total_expenses,
        balance: total_income - total_expenses,
    }))
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/v1/budget/categories", get(get_categories))
        .route("/api/v1/budget/summary", get(get_summary))
}
