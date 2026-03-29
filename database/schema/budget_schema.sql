-- Schema per il sistema di budgeting

-- Tabella delle categorie di budget
CREATE TABLE IF NOT EXISTS budget_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    color TEXT DEFAULT '#6366f1',
    icon TEXT,
    parent_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES budget_categories(id)
);

-- Tabella delle transazioni di budget
CREATE TABLE IF NOT EXISTS budget_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    description TEXT,
    date DATE NOT NULL,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT 0,
    recurring_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
    tags TEXT, -- JSON array of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES budget_categories(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Tabella per i budget mensili
CREATE TABLE IF NOT EXISTS budget_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    limit_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES budget_categories(id),
    UNIQUE(category_id, month, year)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON budget_transactions(date);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_category ON budget_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_type ON budget_transactions(type);
CREATE INDEX IF NOT EXISTS idx_budget_limits_period ON budget_limits(year, month);

-- Inserimento categorie di default
INSERT INTO budget_categories (name, type, color, icon) VALUES
-- Categorie Entrate
('Stipendio', 'income', '#10b981', '💼'),
('Freelance', 'income', '#14b8a6', '💻'),
('Investimenti', 'income', '#06b6d4', '📈'),
('Bonus', 'income', '#8b5cf6', '🎁'),
('Altro (Entrate)', 'income', '#6b7280', '💰'),

-- Categorie Spese
('Alimentari', 'expense', '#ef4444', '🛒'),
('Ristoranti', 'expense', '#f97316', '🍽️'),
('Trasporti', 'expense', '#eab308', '🚗'),
('Bollette', 'expense', '#84cc16', '💡'),
('Affitto/Mutuo', 'expense', '#22c55e', '🏠'),
('Salute', 'expense', '#14b8a6', '⚕️'),
('Intrattenimento', 'expense', '#06b6d4', '🎬'),
('Shopping', 'expense', '#8b5cf6', '🛍️'),
('Abbonamenti', 'expense', '#ec4899', '📱'),
('Educazione', 'expense', '#f43f5e', '📚'),
('Altro (Spese)', 'expense', '#6b7280', '💸');

-- Trigger per aggiornare updated_at
CREATE TRIGGER IF NOT EXISTS update_budget_transactions_timestamp
AFTER UPDATE ON budget_transactions
BEGIN
    UPDATE budget_transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_budget_categories_timestamp
AFTER UPDATE ON budget_categories
BEGIN
    UPDATE budget_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_budget_limits_timestamp
AFTER UPDATE ON budget_limits
BEGIN
    UPDATE budget_limits SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Tabella per le spese ricorrenti
CREATE TABLE IF NOT EXISTS recurring_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')),
    custom_days INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES budget_categories(id)
);

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_category ON recurring_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active);

-- Trigger per aggiornare updated_at
CREATE TRIGGER IF NOT EXISTS update_recurring_expenses_timestamp
AFTER UPDATE ON recurring_expenses
BEGIN
    UPDATE recurring_expenses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
