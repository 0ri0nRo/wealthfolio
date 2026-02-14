-- Rollback migration for budget tables

DROP TRIGGER IF EXISTS update_budget_limits_timestamp;
DROP TRIGGER IF EXISTS update_budget_categories_timestamp;
DROP TRIGGER IF EXISTS update_budget_transactions_timestamp;

DROP INDEX IF EXISTS idx_budget_limits_period;
DROP INDEX IF EXISTS idx_budget_transactions_type;
DROP INDEX IF EXISTS idx_budget_transactions_category;
DROP INDEX IF EXISTS idx_budget_transactions_date;

DROP TABLE IF EXISTS budget_limits;
DROP TABLE IF EXISTS budget_transactions;
DROP TABLE IF EXISTS budget_categories;
