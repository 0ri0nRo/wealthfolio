use crate::{error::ApiResult, main_lib::AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
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

#[derive(Debug, Deserialize)]
struct CreateTransactionRequest {
    category_id: i64,
    amount: f64,
    transaction_type: String,
    description: String,
    date: String,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateTransactionRequest {
    category_id: Option<i64>,
    amount: Option<f64>,
    transaction_type: Option<String>,
    description: Option<String>,
    date: Option<String>,
    notes: Option<String>,
}

async fn get_categories(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Vec<BudgetCategory>>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
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

async fn get_transactions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TransactionQuery>,
) -> ApiResult<Json<Vec<BudgetTransaction>>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    let start_date = format!("{:04}-{:02}-01", query.year, query.month);
    let end_date = if query.month == 12 {
        format!("{:04}-01-01", query.year + 1)
    } else {
        format!("{:04}-{:02}-01", query.year, query.month + 1)
    };

    #[derive(QueryableByName)]
    struct TransactionRow {
        #[diesel(sql_type = BigInt)]
        id: i64,
        #[diesel(sql_type = BigInt)]
        category_id: i64,
        #[diesel(sql_type = Double)]
        amount: f64,
        #[diesel(sql_type = Text, column_name = "type")]
        transaction_type: String,
        #[diesel(sql_type = Text)]
        description: String,
        #[diesel(sql_type = Text)]
        date: String,
        #[diesel(sql_type = Nullable<Text>)]
        notes: Option<String>,
    }

    let rows: Vec<TransactionRow> = diesel::sql_query(
        "SELECT id, category_id, amount, type, description, date, notes
         FROM budget_transactions
         WHERE date >= ? AND date < ?
         ORDER BY date DESC",
    )
    .bind::<Text, _>(&start_date)
    .bind::<Text, _>(&end_date)
    .load(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    let transactions = rows
        .into_iter()
        .map(|row| BudgetTransaction {
            id: Some(row.id),
            category_id: row.category_id,
            amount: row.amount,
            transaction_type: row.transaction_type,
            description: row.description,
            date: row.date,
            notes: row.notes,
        })
        .collect();

    Ok(Json(transactions))
}

async fn create_transaction(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTransactionRequest>,
) -> ApiResult<Json<BudgetTransaction>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    diesel::sql_query(
        "INSERT INTO budget_transactions (category_id, amount, type, description, date, notes, is_recurring, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))",
    )
    .bind::<BigInt, _>(payload.category_id)
    .bind::<Double, _>(payload.amount)
    .bind::<Text, _>(&payload.transaction_type)
    .bind::<Text, _>(&payload.description)
    .bind::<Text, _>(&payload.date)
    .bind::<Nullable<Text>, _>(payload.notes.as_deref())
    .execute(&mut conn)
    .map_err(|e| anyhow::anyhow!("Insert error: {}", e))?;

    #[derive(QueryableByName)]
    struct LastId {
        #[diesel(sql_type = BigInt)]
        id: i64,
    }

    let id: i64 = diesel::sql_query("SELECT last_insert_rowid() as id")
        .get_result::<LastId>(&mut conn)
        .map(|r| r.id)
        .map_err(|e| anyhow::anyhow!("Get ID error: {}", e))?;

    Ok(Json(BudgetTransaction {
        id: Some(id),
        category_id: payload.category_id,
        amount: payload.amount,
        transaction_type: payload.transaction_type,
        description: payload.description,
        date: payload.date,
        notes: payload.notes,
    }))
}

async fn update_transaction(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> ApiResult<StatusCode> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    let mut updates = vec![];

    if let Some(cat_id) = payload.category_id {
        updates.push(format!("category_id = {}", cat_id));
    }
    if let Some(amt) = payload.amount {
        updates.push(format!("amount = {}", amt));
    }
    if let Some(ref typ) = payload.transaction_type {
        updates.push(format!("type = '{}'", typ.replace("'", "''")));
    }
    if let Some(ref desc) = payload.description {
        updates.push(format!("description = '{}'", desc.replace("'", "''")));
    }
    if let Some(ref date) = payload.date {
        updates.push(format!("date = '{}'", date));
    }
    if let Some(ref notes) = payload.notes {
        updates.push(format!("notes = '{}'", notes.replace("'", "''")));
    }
    updates.push("updated_at = datetime('now')".to_string());

    if updates.is_empty() {
        return Ok(StatusCode::BAD_REQUEST);
    }

    let query = format!(
        "UPDATE budget_transactions SET {} WHERE id = {}",
        updates.join(", "),
        id
    );

    diesel::sql_query(&query)
        .execute(&mut conn)
        .map_err(|e| anyhow::anyhow!("Update error: {}", e))?;

    Ok(StatusCode::OK)
}

async fn delete_transaction(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    diesel::sql_query("DELETE FROM budget_transactions WHERE id = ?")
        .bind::<BigInt, _>(id)
        .execute(&mut conn)
        .map_err(|e| anyhow::anyhow!("Delete error: {}", e))?;

    Ok(StatusCode::OK)
}

async fn get_summary(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TransactionQuery>,
) -> ApiResult<Json<BudgetSummary>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
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
        .route("/budget/categories", get(get_categories))
        .route(
            "/budget/transactions",
            get(get_transactions).post(create_transaction),
        )
        .route(
            "/budget/transactions/{id}",
            put(update_transaction).delete(delete_transaction),
        )
        .route("/budget/summary", get(get_summary))
}
