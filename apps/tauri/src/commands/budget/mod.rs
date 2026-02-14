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
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, QueryableByName)]
struct LastInsertId {
    #[diesel(sql_type = BigInt, column_name = "last_insert_rowid()")]
    id: i64,
}

#[derive(Debug, QueryableByName)]
struct TypeTotal {
    #[diesel(sql_type = Text, column_name = "type")]
    transaction_type: String,
    #[diesel(sql_type = Double)]
    total: f64,
}

#[derive(Debug, QueryableByName)]
struct Count {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

// Struct per il category breakdown dalla query SQL
#[derive(Debug, QueryableByName)]
struct CategoryBreakdownItem {
    #[diesel(sql_type = BigInt)]
    category_id: i64,
    #[diesel(sql_type = Text)]
    category_name: String,
    #[diesel(sql_type = Text)]
    category_type: String,
    #[diesel(sql_type = Text)]
    category_color: String,
    #[diesel(sql_type = Nullable<Text>)]
    category_icon: Option<String>,
    #[diesel(sql_type = Double)]
    total: f64,
    #[diesel(sql_type = BigInt)]
    transactions: i64,
}

// Struct semplificata per la categoria nel breakdown
#[derive(Debug, Serialize, Deserialize)] // <-- AGGIUNGI Deserialize
#[serde(rename_all = "camelCase")]
pub struct BudgetCategorySimple {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub category_type: String,
    pub color: String,
    pub icon: Option<String>,
}

// Struct per un singolo elemento del breakdown
#[derive(Debug, Serialize, Deserialize)] // <-- AGGIUNGI Deserialize
#[serde(rename_all = "camelCase")]
pub struct CategoryBreakdown {
    pub category: BudgetCategorySimple,
    pub total: f64,
    pub transactions: i64,
    pub percentage: f64,
}

// Struct principale per il summary
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummary {
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
    pub category_breakdown: Vec<CategoryBreakdown>,
}

// ==================== CATEGORY COMMANDS ====================

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
pub async fn create_budget_category(
    name: String,
    category_type: String,
    color: String,
    icon: Option<String>,
    parent_id: Option<i64>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<i64, String> {
    debug!("Creating budget category: {}", name);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    diesel::sql_query(
        "INSERT INTO budget_categories (name, type, color, icon, parent_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)"
    )
    .bind::<diesel::sql_types::Text, _>(&name)
    .bind::<diesel::sql_types::Text, _>(&category_type)
    .bind::<diesel::sql_types::Text, _>(&color)
    .bind::<diesel::sql_types::Nullable<diesel::sql_types::Text>, _>(icon.as_deref())
    .bind::<diesel::sql_types::Nullable<diesel::sql_types::BigInt>, _>(parent_id)
    .bind::<diesel::sql_types::Text, _>(&now)
    .bind::<diesel::sql_types::Text, _>(&now)
    .execute(&mut conn)
    .map_err(|e| e.to_string())?;

    let result: LastInsertId = diesel::sql_query("SELECT last_insert_rowid()")
        .get_result(&mut conn)
        .map_err(|e| e.to_string())?;

    Ok(result.id)
}

#[tauri::command]
pub async fn update_budget_category(
    id: i64,
    name: String,
    category_type: String,
    color: String,
    icon: Option<String>,
    parent_id: Option<i64>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<(), String> {
    debug!("Updating budget category: {}", id);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    diesel::sql_query(
        "UPDATE budget_categories
         SET name = ?, type = ?, color = ?, icon = ?, parent_id = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind::<diesel::sql_types::Text, _>(&name)
    .bind::<diesel::sql_types::Text, _>(&category_type)
    .bind::<diesel::sql_types::Text, _>(&color)
    .bind::<diesel::sql_types::Nullable<diesel::sql_types::Text>, _>(icon.as_deref())
    .bind::<diesel::sql_types::Nullable<diesel::sql_types::BigInt>, _>(parent_id)
    .bind::<diesel::sql_types::Text, _>(&now)
    .bind::<diesel::sql_types::BigInt, _>(id)
    .execute(&mut conn)
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_budget_category(
    id: i64,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<(), String> {
    debug!("Deleting budget category: {}", id);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;

    diesel::sql_query("UPDATE budget_categories SET is_active = 0 WHERE id = ?")
        .bind::<diesel::sql_types::BigInt, _>(id)
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn initialize_default_categories(
    state: State<'_, Arc<ServiceContext>>,
) -> Result<(), String> {
    debug!("Initializing default budget categories...");

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let count: Count = diesel::sql_query("SELECT COUNT(*) as count FROM budget_categories")
        .get_result(&mut conn)
        .map_err(|e| e.to_string())?;

    if count.count > 0 {
        return Ok(());
    }

    let expense_categories = vec![
        ("Food & Dining", "🍔", "#FF6B6B"),
        ("Shopping", "🛍️", "#4ECDC4"),
        ("Transportation", "🚗", "#45B7D1"),
        ("Bills & Utilities", "⚡", "#FFA07A"),
        ("Entertainment", "🎬", "#98D8C8"),
        ("Healthcare", "🏥", "#F7DC6F"),
        ("Education", "📚", "#BB8FCE"),
        ("Travel", "✈️", "#85C1E2"),
        ("Other", "📦", "#95A5A6"),
    ];

    for (name, icon, color) in expense_categories {
        diesel::sql_query(
            "INSERT INTO budget_categories (name, type, color, icon, parent_id, is_active, created_at, updated_at)
             VALUES (?, 'expense', ?, ?, NULL, 1, ?, ?)"
        )
        .bind::<diesel::sql_types::Text, _>(name)
        .bind::<diesel::sql_types::Text, _>(color)
        .bind::<diesel::sql_types::Text, _>(icon)
        .bind::<diesel::sql_types::Text, _>(&now)
        .bind::<diesel::sql_types::Text, _>(&now)
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    }

    let income_categories = vec![
        ("Salary", "💰", "#27AE60"),
        ("Freelance", "💼", "#2ECC71"),
        ("Investments", "📈", "#58D68D"),
        ("Other Income", "💵", "#82E0AA"),
    ];

    for (name, icon, color) in income_categories {
        diesel::sql_query(
            "INSERT INTO budget_categories (name, type, color, icon, parent_id, is_active, created_at, updated_at)
             VALUES (?, 'income', ?, ?, NULL, 1, ?, ?)"
        )
        .bind::<diesel::sql_types::Text, _>(name)
        .bind::<diesel::sql_types::Text, _>(color)
        .bind::<diesel::sql_types::Text, _>(icon)
        .bind::<diesel::sql_types::Text, _>(&now)
        .bind::<diesel::sql_types::Text, _>(&now)
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ==================== TRANSACTION COMMANDS ====================

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
pub async fn update_budget_transaction(
    id: i64,
    category_id: i64,
    amount: f64,
    transaction_type: String,
    description: String,
    date: String,
    notes: Option<String>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<(), String> {
    debug!("Updating budget transaction: {}", id);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;

    diesel::sql_query(
        "UPDATE budget_transactions
         SET category_id = ?, amount = ?, type = ?, description = ?, date = ?, notes = ?
         WHERE id = ?",
    )
    .bind::<diesel::sql_types::BigInt, _>(category_id)
    .bind::<diesel::sql_types::Double, _>(amount)
    .bind::<diesel::sql_types::Text, _>(&transaction_type)
    .bind::<diesel::sql_types::Text, _>(&description)
    .bind::<diesel::sql_types::Text, _>(&date)
    .bind::<diesel::sql_types::Nullable<diesel::sql_types::Text>, _>(notes.as_deref())
    .bind::<diesel::sql_types::BigInt, _>(id)
    .execute(&mut conn)
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_budget_transaction(
    id: i64,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<(), String> {
    debug!("Deleting budget transaction: {}", id);

    let mut conn = state.inner().pool().get().map_err(|e| e.to_string())?;

    diesel::sql_query("DELETE FROM budget_transactions WHERE id = ?")
        .bind::<diesel::sql_types::BigInt, _>(id)
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    Ok(())
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

    // Get total income and expenses
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

    // Get category breakdown
    let breakdown_items: Vec<CategoryBreakdownItem> = diesel::sql_query(
        "SELECT
            c.id as category_id,
            c.name as category_name,
            c.type as category_type,
            c.color as category_color,
            c.icon as category_icon,
            SUM(t.amount) as total,
            COUNT(t.id) as transactions
         FROM budget_transactions t
         JOIN budget_categories c ON t.category_id = c.id
         WHERE t.date >= ? AND t.date < ?
         GROUP BY c.id
         ORDER BY total DESC",
    )
    .bind::<diesel::sql_types::Text, _>(&start_date)
    .bind::<diesel::sql_types::Text, _>(&end_date)
    .load(&mut conn)
    .map_err(|e| e.to_string())?;

    let grand_total = total_income + total_expenses;

    let category_breakdown: Vec<CategoryBreakdown> = breakdown_items
        .into_iter()
        .map(|item| {
            let percentage = if grand_total > 0.0 {
                (item.total / grand_total) * 100.0
            } else {
                0.0
            };

            CategoryBreakdown {
                category: BudgetCategorySimple {
                    id: item.category_id,
                    name: item.category_name,
                    category_type: item.category_type,
                    color: item.category_color,
                    icon: item.category_icon,
                },
                total: item.total,
                transactions: item.transactions,
                percentage,
            }
        })
        .collect();

    Ok(BudgetSummary {
        total_income,
        total_expenses,
        balance: total_income - total_expenses,
        category_breakdown,
    })
}
