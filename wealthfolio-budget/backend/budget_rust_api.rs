// src-tauri/src/budget/mod.rs
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BudgetCategory {
    pub id: Option<i64>,
    pub name: String,
    #[serde(rename = "type")]
    pub category_type: String, // "income" or "expense"
    pub color: String,
    pub icon: Option<String>,
    pub parent_id: Option<i64>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BudgetTransaction {
    pub id: Option<i64>,
    pub account_id: Option<i64>,
    pub category_id: i64,
    pub amount: f64,
    #[serde(rename = "type")]
    pub transaction_type: String, // "income" or "expense"
    pub description: String,
    pub date: String,
    pub notes: Option<String>,
    pub is_recurring: bool,
    pub recurring_pattern: Option<String>,
    pub tags: Option<String>, // JSON array
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<BudgetCategory>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetSummary {
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
    pub period: Period,
    pub category_breakdown: Vec<CategoryBreakdown>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Period {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryBreakdown {
    pub category: BudgetCategory,
    pub total: f64,
    pub transactions: i64,
    pub percentage: f64,
}

// Commands per Tauri
#[tauri::command]
pub fn get_budget_categories(conn: tauri::State<Connection>) -> Result<Vec<BudgetCategory>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, type, color, icon, parent_id, is_active, created_at, updated_at 
             FROM budget_categories 
             WHERE is_active = 1 
             ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map([], |row| {
            Ok(BudgetCategory {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                category_type: row.get(2)?,
                color: row.get(3)?,
                icon: row.get(4)?,
                parent_id: row.get(5)?,
                is_active: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
}

#[tauri::command]
pub fn get_budget_transactions(
    conn: tauri::State<Connection>,
    month: u32,
    year: i32,
) -> Result<Vec<BudgetTransaction>, String> {
    let start_date = format!("{:04}-{:02}-01", year, month);
    let end_date = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month + 1)
    };

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.account_id, t.category_id, t.amount, t.type, t.description, 
                    t.date, t.notes, t.is_recurring, t.recurring_pattern, t.tags,
                    t.created_at, t.updated_at,
                    c.id, c.name, c.type, c.color, c.icon, c.parent_id, c.is_active,
                    c.created_at, c.updated_at
             FROM budget_transactions t
             JOIN budget_categories c ON t.category_id = c.id
             WHERE t.date >= ?1 AND t.date < ?2
             ORDER BY t.date DESC",
        )
        .map_err(|e| e.to_string())?;

    let transactions = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(BudgetTransaction {
                id: Some(row.get(0)?),
                account_id: row.get(1)?,
                category_id: row.get(2)?,
                amount: row.get(3)?,
                transaction_type: row.get(4)?,
                description: row.get(5)?,
                date: row.get(6)?,
                notes: row.get(7)?,
                is_recurring: row.get(8)?,
                recurring_pattern: row.get(9)?,
                tags: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                category: Some(BudgetCategory {
                    id: Some(row.get(13)?),
                    name: row.get(14)?,
                    category_type: row.get(15)?,
                    color: row.get(16)?,
                    icon: row.get(17)?,
                    parent_id: row.get(18)?,
                    is_active: row.get(19)?,
                    created_at: row.get(20)?,
                    updated_at: row.get(21)?,
                }),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(transactions)
}

#[tauri::command]
pub fn create_budget_transaction(
    conn: tauri::State<Connection>,
    transaction: BudgetTransaction,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO budget_transactions 
         (account_id, category_id, amount, type, description, date, notes, is_recurring, recurring_pattern, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            transaction.account_id,
            transaction.category_id,
            transaction.amount,
            transaction.transaction_type,
            transaction.description,
            transaction.date,
            transaction.notes,
            transaction.is_recurring,
            transaction.recurring_pattern,
            transaction.tags,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_budget_transaction(
    conn: tauri::State<Connection>,
    id: i64,
    transaction: BudgetTransaction,
) -> Result<(), String> {
    conn.execute(
        "UPDATE budget_transactions 
         SET category_id = ?1, amount = ?2, type = ?3, description = ?4, 
             date = ?5, notes = ?6, is_recurring = ?7, recurring_pattern = ?8, tags = ?9
         WHERE id = ?10",
        params![
            transaction.category_id,
            transaction.amount,
            transaction.transaction_type,
            transaction.description,
            transaction.date,
            transaction.notes,
            transaction.is_recurring,
            transaction.recurring_pattern,
            transaction.tags,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_budget_transaction(
    conn: tauri::State<Connection>,
    id: i64,
) -> Result<(), String> {
    conn.execute("DELETE FROM budget_transactions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_budget_summary(
    conn: tauri::State<Connection>,
    month: u32,
    year: i32,
) -> Result<BudgetSummary, String> {
    let start_date = format!("{:04}-{:02}-01", year, month);
    let end_date = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month + 1)
    };

    // Get total income and expenses
    let mut stmt = conn
        .prepare(
            "SELECT type, SUM(amount) 
             FROM budget_transactions 
             WHERE date >= ?1 AND date < ?2 
             GROUP BY type",
        )
        .map_err(|e| e.to_string())?;

    let mut total_income = 0.0;
    let mut total_expenses = 0.0;

    let totals = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for result in totals {
        let (transaction_type, amount) = result.map_err(|e| e.to_string())?;
        match transaction_type.as_str() {
            "income" => total_income = amount,
            "expense" => total_expenses = amount,
            _ => {}
        }
    }

    // Get category breakdown
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.type, c.color, c.icon, c.parent_id, c.is_active,
                    c.created_at, c.updated_at,
                    SUM(t.amount) as total, COUNT(t.id) as count
             FROM budget_transactions t
             JOIN budget_categories c ON t.category_id = c.id
             WHERE t.date >= ?1 AND t.date < ?2
             GROUP BY c.id
             ORDER BY total DESC",
        )
        .map_err(|e| e.to_string())?;

    let category_breakdown = stmt
        .query_map(params![start_date, end_date], |row| {
            let total: f64 = row.get(9)?;
            let grand_total = total_income + total_expenses;
            let percentage = if grand_total > 0.0 {
                (total / grand_total) * 100.0
            } else {
                0.0
            };

            Ok(CategoryBreakdown {
                category: BudgetCategory {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    category_type: row.get(2)?,
                    color: row.get(3)?,
                    icon: row.get(4)?,
                    parent_id: row.get(5)?,
                    is_active: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                },
                total,
                transactions: row.get(10)?,
                percentage,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(BudgetSummary {
        total_income,
        total_expenses,
        balance: total_income - total_expenses,
        period: Period {
            start: start_date,
            end: end_date,
        },
        category_breakdown,
    })
}

#[tauri::command]
pub fn create_budget_category(
    conn: tauri::State<Connection>,
    category: BudgetCategory,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO budget_categories (name, type, color, icon, parent_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            category.name,
            category.category_type,
            category.color,
            category.icon,
            category.parent_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}
