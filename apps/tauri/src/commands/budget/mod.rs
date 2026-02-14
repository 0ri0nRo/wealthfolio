use crate::context::ServiceContext;
use diesel::deserialize::QueryableByName;
use diesel::prelude::*;
use diesel::sql_types::*;
use log::debug;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Queryable, QueryableByName)]
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

// Struttura helper per QueryableByName
#[derive(Debug, QueryableByName)]
struct BudgetTransactionRow {
    #[diesel(sql_type = Nullable<BigInt>)]
    id: Option<i64>,
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

// Struttura helper per last_insert_rowid
#[derive(Debug, QueryableByName)]
struct LastInsertId {
    #[diesel(sql_type = BigInt, column_name = "last_insert_rowid()")]
    id: i64,
}

// Struttura helper per i totali
#[derive(Debug, QueryableByName)]
struct TypeTotal {
    #[diesel(sql_type = Text, column_name = "type")]
    transaction_type: String,
    #[diesel(sql_type = Double)]
    total: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetSummary {
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
}

#[tauri::command]
pub async fn get_budget_categories(
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<BudgetCategory>, String> {
    debug!("Fetching budget categories...");

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;

    let categories: Vec<BudgetCategory> = diesel::sql_query(
        "SELECT id, name, type, color, icon, parent_id, is_active, created_at, updated_at
         FROM budget_categories
         WHERE is_active = 1
         ORDER BY name",
    )
    .load(&mut conn)
    .map_err(|e| e.to_string())?;

    Ok(categories)
}

#[tauri::command]
pub async fn get_budget_transactions(
    month: u32,
    year: i32,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<BudgetTransaction>, String> {
    debug!("Fetching budget transactions for {}/{}", month, year);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;

    let start_date = format!("{:04}-{:02}-01", year, month);
    let end_date = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month + 1)
    };

    let transactions: Vec<BudgetTransactionRow> = diesel::sql_query(
        "SELECT id, category_id, amount, type, description, date, notes
         FROM budget_transactions
         WHERE date >= ? AND date < ?
         ORDER BY date DESC",
    )
    .bind::<diesel::sql_types::Text, _>(&start_date)
    .bind::<diesel::sql_types::Text, _>(&end_date)
    .load(&mut conn)
    .map_err(|e| e.to_string())?;

    let result = transactions
        .into_iter()
        .map(|row| BudgetTransaction {
            id: row.id,
            category_id: row.category_id,
            amount: row.amount,
            transaction_type: row.transaction_type,
            description: row.description,
            date: row.date,
            notes: row.notes,
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn create_budget_transaction(
    category_id: i64,
    amount: f64,
    transaction_type: String,
    description: String,
    date: String,
    notes: Option<String>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<i64, String> {
    debug!("Creating budget transaction: {} - {}", description, amount);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;

    diesel::sql_query(
        "INSERT INTO budget_transactions (category_id, amount, type, description, date, notes, is_recurring)
         VALUES (?, ?, ?, ?, ?, ?, 0)"
    )
    .bind::<diesel::sql_types::BigInt, _>(category_id)
    .bind::<diesel::sql_types::Double, _>(amount)
    .bind::<diesel::sql_types::Text, _>(&transaction_type)
    .bind::<diesel::sql_types::Text, _>(&description)
    .bind::<diesel::sql_types::Text, _>(&date)
    .bind::<diesel::sql_types::Nullable<diesel::sql_types::Text>, _>(notes.as_deref())
    .execute(&mut conn)
    .map_err(|e| e.to_string())?;

    let result: LastInsertId = diesel::sql_query("SELECT last_insert_rowid()")
        .get_result(&mut conn)
        .map_err(|e| e.to_string())?;

    Ok(result.id)
}

#[tauri::command]
pub async fn get_budget_summary(
    month: u32,
    year: i32,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<BudgetSummary, String> {
    debug!("Fetching budget summary for {}/{}", month, year);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;

    let start_date = format!("{:04}-{:02}-01", year, month);
    let end_date = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month + 1)
    };

    let totals: Vec<TypeTotal> = diesel::sql_query(
        "SELECT type, SUM(amount) as total
         FROM budget_transactions
         WHERE date >= ? AND date < ?
         GROUP BY type",
    )
    .bind::<diesel::sql_types::Text, _>(&start_date)
    .bind::<diesel::sql_types::Text, _>(&end_date)
    .load(&mut conn)
    .map_err(|e| e.to_string())?;

    let mut total_income = 0.0;
    let mut total_expenses = 0.0;

    for row in totals {
        match row.transaction_type.as_str() {
            "income" => total_income = row.total,
            "expense" => total_expenses = row.total,
            _ => {}
        }
    }

    Ok(BudgetSummary {
        total_income,
        total_expenses,
        balance: total_income - total_expenses,
    })
}
