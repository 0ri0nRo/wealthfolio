-- Categorie personalizzate per il budget

-- Categorie di Entrate (Income)
INSERT INTO budget_categories (name, type, color, icon) VALUES
('Salary', 'income', '#10b981', '💼'),
('Buoni pasto', 'income', '#22c55e', '🍱'),
('Other Income', 'income', '#6b7280', '💰');

-- Categorie di Spese (Expenses)
INSERT INTO budget_categories (name, type, color, icon) VALUES
('Housing', 'expense', '#ef4444', '🏠'),
('Leisure', 'expense', '#8b5cf6', '🎮'),
('Health', 'expense', '#14b8a6', '⚕️'),
('Transport', 'expense', '#eab308', '🚗'),
('University', 'expense', '#f43f5e', '📚'),
('Bar', 'expense', '#f97316', '☕'),
('Clothing', 'expense', '#ec4899', '👔'),
('Groceries', 'expense', '#84cc16', '🛒'),
('Gifts', 'expense', '#06b6d4', '🎁'),
('Fees', 'expense', '#64748b', '💳'),
('Bills', 'expense', '#fbbf24', '💡'),
('Restaurants', 'expense', '#fb923c', '🍽️'),
('Vacation', 'expense', '#a855f7', '✈️'),
('Other', 'expense', '#6b7280', '📦');
