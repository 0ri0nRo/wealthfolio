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

#[derive(Debug, Serialize, Deserialize, QueryableByName)]
pub struct RecurringExpense {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = BigInt)]
    pub category_id: i64,
    #[diesel(sql_type = Double)]
    pub amount: f64,
    #[diesel(sql_type = Text)]
    pub description: String,
    #[diesel(sql_type = Text)]
    pub frequency: String,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub custom_days: Option<i64>,
    #[diesel(sql_type = Text)]
    pub start_date: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub end_date: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub notes: Option<String>,
    #[diesel(sql_type = BigInt)]
    pub is_active: i64,
    #[diesel(sql_type = Text)]
    pub created_at: String,
    #[diesel(sql_type = Text)]
    pub updated_at: String,
}

/// One row per (recurring_expense_id, year, month) — editable per month
#[derive(Debug, Serialize, Deserialize, QueryableByName)]
pub struct RecurringExpenseEntry {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = BigInt)]
    pub recurring_expense_id: i64,
    #[diesel(sql_type = BigInt)]
    pub year: i64,
    #[diesel(sql_type = BigInt)]
    pub month: i64,
    #[diesel(sql_type = Double)]
    pub amount: f64,
    #[diesel(sql_type = Nullable<Text>)]
    pub notes: Option<String>,
    #[diesel(sql_type = Text)]
    pub created_at: String,
    #[diesel(sql_type = Text)]
    pub updated_at: String,
}

// ── Request structs ───────────────────────────────────────────────────────────

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

#[derive(Debug, Deserialize)]
struct CreateCategoryRequest {
    name: String,
    #[serde(rename = "type")]
    category_type: String,
    color: String,
    icon: Option<String>,
    parent_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct UpdateCategoryRequest {
    name: Option<String>,
    #[serde(rename = "type")]
    category_type: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    parent_id: Option<i64>,
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CreateRecurringExpenseRequest {
    category_id: i64,
    amount: f64,
    description: String,
    frequency: String,
    custom_days: Option<i64>,
    start_date: String,
    end_date: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateRecurringExpenseRequest {
    category_id: Option<i64>,
    amount: Option<f64>,
    description: Option<String>,
    frequency: Option<String>,
    custom_days: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
    notes: Option<String>,
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct UpsertEntryRequest {
    recurring_expense_id: i64,
    year: i64,
    month: i64,
    amount: f64,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EntriesQuery {
    /// Optional: filter by year
    year: Option<i64>,
    /// Optional: filter by month (1-12)
    month: Option<i64>,
    /// Optional: filter by recurring_expense_id
    recurring_expense_id: Option<i64>,
}

// ── Categories ────────────────────────────────────────────────────────────────

async fn get_categories(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Vec<BudgetCategory>>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    let categories: Vec<BudgetCategory> = diesel::sql_query(
        "SELECT id, name, type, color, icon, parent_id, is_active, created_at, updated_at
         FROM budget_categories WHERE is_active = 1 ORDER BY name",
    )
    .load(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;
    Ok(Json(categories))
}

async fn create_category(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateCategoryRequest>,
) -> ApiResult<Json<BudgetCategory>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    diesel::sql_query(
        "INSERT INTO budget_categories (name, type, color, icon, parent_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
    )
    .bind::<Text, _>(&payload.name)
    .bind::<Text, _>(&payload.category_type)
    .bind::<Text, _>(&payload.color)
    .bind::<Nullable<Text>, _>(payload.icon.as_deref())
    .bind::<Nullable<BigInt>, _>(payload.parent_id)
    .execute(&mut conn).map_err(|e| anyhow::anyhow!("Insert error: {}", e))?;

    #[derive(QueryableByName)]
    struct LastId {
        #[diesel(sql_type = BigInt)]
        id: i64,
    }
    let id: i64 = diesel::sql_query("SELECT last_insert_rowid() as id")
        .get_result::<LastId>(&mut conn)
        .map(|r| r.id)
        .map_err(|e| anyhow::anyhow!("Get ID error: {}", e))?;

    let category: BudgetCategory = diesel::sql_query(
        "SELECT id, name, type, color, icon, parent_id, is_active, created_at, updated_at
         FROM budget_categories WHERE id = ?",
    )
    .bind::<BigInt, _>(id)
    .get_result(&mut conn)
    .map_err(|e| anyhow::anyhow!("Fetch error: {}", e))?;
    Ok(Json(category))
}

async fn update_category(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateCategoryRequest>,
) -> ApiResult<StatusCode> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    let mut updates = vec![];
    if let Some(ref v) = payload.name {
        updates.push(format!("name = '{}'", v.replace("'", "''")));
    }
    if let Some(ref v) = payload.category_type {
        updates.push(format!("type = '{}'", v.replace("'", "''")));
    }
    if let Some(ref v) = payload.color {
        updates.push(format!("color = '{}'", v.replace("'", "''")));
    }
    if let Some(ref v) = payload.icon {
        updates.push(format!("icon = '{}'", v.replace("'", "''")));
    }
    if let Some(v) = payload.parent_id {
        updates.push(format!("parent_id = {}", v));
    }
    if let Some(v) = payload.is_active {
        updates.push(format!("is_active = {}", if v { 1 } else { 0 }));
    }
    updates.push("updated_at = datetime('now')".into());
    diesel::sql_query(&format!(
        "UPDATE budget_categories SET {} WHERE id = {}",
        updates.join(", "),
        id
    ))
    .execute(&mut conn)
    .map_err(|e| anyhow::anyhow!("Update error: {}", e))?;
    Ok(StatusCode::OK)
}

async fn delete_category(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    diesel::sql_query(
        "UPDATE budget_categories SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
    )
    .bind::<BigInt, _>(id)
    .execute(&mut conn)
    .map_err(|e| anyhow::anyhow!("Delete error: {}", e))?;
    Ok(StatusCode::OK)
}

// ── Transactions ──────────────────────────────────────────────────────────────

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
         FROM budget_transactions WHERE date >= ? AND date < ? ORDER BY date DESC",
    )
    .bind::<Text, _>(&start_date)
    .bind::<Text, _>(&end_date)
    .load(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    Ok(Json(
        rows.into_iter()
            .map(|r| BudgetTransaction {
                id: Some(r.id),
                category_id: r.category_id,
                amount: r.amount,
                transaction_type: r.transaction_type,
                description: r.description,
                date: r.date,
                notes: r.notes,
            })
            .collect(),
    ))
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
    .execute(&mut conn).map_err(|e| anyhow::anyhow!("Insert error: {}", e))?;

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
    if let Some(v) = payload.category_id {
        updates.push(format!("category_id = {}", v));
    }
    if let Some(v) = payload.amount {
        updates.push(format!("amount = {}", v));
    }
    if let Some(ref v) = payload.transaction_type {
        updates.push(format!("type = '{}'", v.replace("'", "''")));
    }
    if let Some(ref v) = payload.description {
        updates.push(format!("description = '{}'", v.replace("'", "''")));
    }
    if let Some(ref v) = payload.date {
        updates.push(format!("date = '{}'", v));
    }
    if let Some(ref v) = payload.notes {
        updates.push(format!("notes = '{}'", v.replace("'", "''")));
    }
    updates.push("updated_at = datetime('now')".into());
    diesel::sql_query(&format!(
        "UPDATE budget_transactions SET {} WHERE id = {}",
        updates.join(", "),
        id
    ))
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
        "SELECT type, SUM(amount) as total FROM budget_transactions
         WHERE date >= ? AND date < ? GROUP BY type",
    )
    .bind::<Text, _>(&start_date)
    .bind::<Text, _>(&end_date)
    .load(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    let mut total_income = 0.0_f64;
    let mut total_expenses = 0.0_f64;
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

// ── Recurring Expenses ────────────────────────────────────────────────────────

async fn get_recurring_expenses(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Vec<RecurringExpense>>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    let expenses: Vec<RecurringExpense> = diesel::sql_query(
        "SELECT id, category_id, amount, description, frequency, custom_days,
                start_date, end_date, notes, is_active, created_at, updated_at
         FROM recurring_expenses ORDER BY is_active DESC, description ASC",
    )
    .load(&mut conn)
    .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;
    Ok(Json(expenses))
}

async fn create_recurring_expense(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateRecurringExpenseRequest>,
) -> ApiResult<Json<RecurringExpense>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    diesel::sql_query(
        "INSERT INTO recurring_expenses
         (category_id, amount, description, frequency, custom_days, start_date, end_date, notes, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
    )
    .bind::<BigInt, _>(payload.category_id)
    .bind::<Double, _>(payload.amount)
    .bind::<Text, _>(&payload.description)
    .bind::<Text, _>(&payload.frequency)
    .bind::<Nullable<BigInt>, _>(payload.custom_days)
    .bind::<Text, _>(&payload.start_date)
    .bind::<Nullable<Text>, _>(payload.end_date.as_deref())
    .bind::<Nullable<Text>, _>(payload.notes.as_deref())
    .execute(&mut conn).map_err(|e| anyhow::anyhow!("Insert error: {}", e))?;

    #[derive(QueryableByName)]
    struct LastId {
        #[diesel(sql_type = BigInt)]
        id: i64,
    }
    let id: i64 = diesel::sql_query("SELECT last_insert_rowid() as id")
        .get_result::<LastId>(&mut conn)
        .map(|r| r.id)
        .map_err(|e| anyhow::anyhow!("Get ID error: {}", e))?;

    let expense: RecurringExpense = diesel::sql_query(
        "SELECT id, category_id, amount, description, frequency, custom_days,
                start_date, end_date, notes, is_active, created_at, updated_at
         FROM recurring_expenses WHERE id = ?",
    )
    .bind::<BigInt, _>(id)
    .get_result(&mut conn)
    .map_err(|e| anyhow::anyhow!("Fetch error: {}", e))?;
    Ok(Json(expense))
}

async fn update_recurring_expense(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateRecurringExpenseRequest>,
) -> ApiResult<StatusCode> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    let mut updates = vec![];
    if let Some(v) = payload.category_id {
        updates.push(format!("category_id = {}", v));
    }
    if let Some(v) = payload.amount {
        updates.push(format!("amount = {}", v));
    }
    if let Some(ref v) = payload.description {
        updates.push(format!("description = '{}'", v.replace("'", "''")));
    }
    if let Some(ref v) = payload.frequency {
        updates.push(format!("frequency = '{}'", v.replace("'", "''")));
    }
    if let Some(v) = payload.custom_days {
        updates.push(format!("custom_days = {}", v));
    }
    if let Some(ref v) = payload.start_date {
        updates.push(format!("start_date = '{}'", v));
    }
    if let Some(ref v) = payload.end_date {
        updates.push(format!("end_date = '{}'", v.replace("'", "''")));
    }
    if let Some(ref v) = payload.notes {
        updates.push(format!("notes = '{}'", v.replace("'", "''")));
    }
    if let Some(v) = payload.is_active {
        updates.push(format!("is_active = {}", if v { 1 } else { 0 }));
    }
    updates.push("updated_at = datetime('now')".into());
    diesel::sql_query(&format!(
        "UPDATE recurring_expenses SET {} WHERE id = {}",
        updates.join(", "),
        id
    ))
    .execute(&mut conn)
    .map_err(|e| anyhow::anyhow!("Update error: {}", e))?;
    Ok(StatusCode::OK)
}

async fn delete_recurring_expense(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    diesel::sql_query("DELETE FROM recurring_expenses WHERE id = ?")
        .bind::<BigInt, _>(id)
        .execute(&mut conn)
        .map_err(|e| anyhow::anyhow!("Delete error: {}", e))?;
    Ok(StatusCode::OK)
}

// ── Recurring Expense Entries ─────────────────────────────────────────────────

/// GET /budget/recurring-entries?year=2026&month=3
/// Returns all entries for the given period.
/// Also auto-creates missing entries for active recurring expenses in that month.
async fn get_recurring_entries(
    State(state): State<Arc<AppState>>,
    Query(query): Query<EntriesQuery>,
) -> ApiResult<Json<Vec<RecurringExpenseEntry>>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    // If year+month supplied, auto-ensure entries exist for active recurring expenses
    if let (Some(year), Some(month)) = (query.year, query.month) {
        // Load all active recurring expenses whose start_date <= end of month
        // and end_date is null or >= start of month
        let month_start = format!("{:04}-{:02}-01", year, month);
        let month_end = if month == 12 {
            format!("{:04}-01-01", year + 1)
        } else {
            format!("{:04}-{:02}-01", year, month + 1)
        };

        #[derive(QueryableByName)]
        struct ActiveRecurring {
            #[diesel(sql_type = BigInt)]
            id: i64,
            #[diesel(sql_type = Double)]
            amount: f64,
        }

        let active: Vec<ActiveRecurring> = diesel::sql_query(
            "SELECT id, amount FROM recurring_expenses
             WHERE is_active = 1
               AND start_date < ?
               AND (end_date IS NULL OR end_date >= ?)",
        )
        .bind::<Text, _>(&month_end)
        .bind::<Text, _>(&month_start)
        .load(&mut conn)
        .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

        // For each active recurring, insert an entry if it doesn't exist yet
        for rec in &active {
            diesel::sql_query(
                "INSERT OR IGNORE INTO recurring_expense_entries
                 (recurring_expense_id, year, month, amount, created_at, updated_at)
                 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
            )
            .bind::<BigInt, _>(rec.id)
            .bind::<BigInt, _>(year)
            .bind::<BigInt, _>(month)
            .bind::<Double, _>(rec.amount)
            .execute(&mut conn)
            .map_err(|e| anyhow::anyhow!("Auto-insert error: {}", e))?;
        }
    }

    // Build WHERE clause
    let mut conditions = vec!["1=1".to_string()];
    if let Some(y) = query.year {
        conditions.push(format!("year = {}", y));
    }
    if let Some(m) = query.month {
        conditions.push(format!("month = {}", m));
    }
    if let Some(rid) = query.recurring_expense_id {
        conditions.push(format!("recurring_expense_id = {}", rid));
    }

    let sql = format!(
        "SELECT id, recurring_expense_id, year, month, amount, notes, created_at, updated_at
         FROM recurring_expense_entries WHERE {} ORDER BY year DESC, month DESC",
        conditions.join(" AND ")
    );

    let entries: Vec<RecurringExpenseEntry> = diesel::sql_query(&sql)
        .load(&mut conn)
        .map_err(|e| anyhow::anyhow!("DB error: {}", e))?;

    Ok(Json(entries))
}

/// PUT /budget/recurring-entries — upsert a single entry (edit amount for a specific month)
async fn upsert_recurring_entry(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpsertEntryRequest>,
) -> ApiResult<Json<RecurringExpenseEntry>> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;

    diesel::sql_query(
        "INSERT INTO recurring_expense_entries
         (recurring_expense_id, year, month, amount, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(recurring_expense_id, year, month)
         DO UPDATE SET amount = excluded.amount,
                       notes  = excluded.notes,
                       updated_at = datetime('now')",
    )
    .bind::<BigInt, _>(payload.recurring_expense_id)
    .bind::<BigInt, _>(payload.year)
    .bind::<BigInt, _>(payload.month)
    .bind::<Double, _>(payload.amount)
    .bind::<Nullable<Text>, _>(payload.notes.as_deref())
    .execute(&mut conn)
    .map_err(|e| anyhow::anyhow!("Upsert error: {}", e))?;

    let entry: RecurringExpenseEntry = diesel::sql_query(
        "SELECT id, recurring_expense_id, year, month, amount, notes, created_at, updated_at
         FROM recurring_expense_entries
         WHERE recurring_expense_id = ? AND year = ? AND month = ?",
    )
    .bind::<BigInt, _>(payload.recurring_expense_id)
    .bind::<BigInt, _>(payload.year)
    .bind::<BigInt, _>(payload.month)
    .get_result(&mut conn)
    .map_err(|e| anyhow::anyhow!("Fetch error: {}", e))?;

    Ok(Json(entry))
}

/// DELETE /budget/recurring-entries/:id
async fn delete_recurring_entry(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    let mut conn = state
        .pool
        .get()
        .map_err(|e| anyhow::anyhow!("Pool error: {}", e))?;
    diesel::sql_query("DELETE FROM recurring_expense_entries WHERE id = ?")
        .bind::<BigInt, _>(id)
        .execute(&mut conn)
        .map_err(|e| anyhow::anyhow!("Delete error: {}", e))?;
    Ok(StatusCode::OK)
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/budget/categories",
            get(get_categories).post(create_category),
        )
        .route(
            "/budget/categories/{id}",
            put(update_category).delete(delete_category),
        )
        .route(
            "/budget/transactions",
            get(get_transactions).post(create_transaction),
        )
        .route(
            "/budget/transactions/{id}",
            put(update_transaction).delete(delete_transaction),
        )
        .route("/budget/summary", get(get_summary))
        .route(
            "/budget/recurring-expenses",
            get(get_recurring_expenses).post(create_recurring_expense),
        )
        .route(
            "/budget/recurring-expenses/{id}",
            put(update_recurring_expense).delete(delete_recurring_expense),
        )
        // Entries: one record per (recurring, year, month)
        .route(
            "/budget/recurring-entries",
            get(get_recurring_entries).put(upsert_recurring_entry),
        )
        .route(
            "/budget/recurring-entries/{id}",
            delete(delete_recurring_entry),
        )
}
