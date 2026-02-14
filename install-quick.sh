#!/bin/bash

# Budget System Quick Install
# Extract this ZIP in your wealthfolio directory and run this script

echo "╔════════════════════════════════════════════════════╗"
echo "║   Budget System - Quick Installation              ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if we're in wealthfolio directory
if [ ! -d "packages/ui/src" ]; then
    echo "❌ Error: Please extract this ZIP in your wealthfolio root directory"
    echo ""
    echo "Example:"
    echo "  cd /path/to/wealthfolio"
    echo "  unzip budget-system-complete.zip"
    echo "  ./install.sh"
    exit 1
fi

echo "✓ Wealthfolio directory detected"
echo ""

# Create folders
echo "📁 Creating folders..."
mkdir -p packages/ui/src/lib/types
mkdir -p packages/ui/src/pages/budget/components
mkdir -p database/schema
echo "✓ Folders created"
echo ""

# Copy files
echo "📄 Installing files..."

# Types
cp wealthfolio-budget/frontend/budget-types.ts packages/ui/src/lib/types/budget.ts
echo "  ✓ budget.ts"

# Hook
cp wealthfolio-budget/frontend/useBudget.ts packages/ui/src/hooks/
echo "  ✓ useBudget.ts"

# Main page
cp wealthfolio-budget/frontend/BudgetPage.tsx packages/ui/src/pages/budget/index.tsx
echo "  ✓ index.tsx"

# Components
cp wealthfolio-budget/frontend/BudgetChart.tsx packages/ui/src/pages/budget/components/budget-chart.tsx
echo "  ✓ budget-chart.tsx"

cp wealthfolio-budget/frontend/TransactionList.tsx packages/ui/src/pages/budget/components/transaction-list.tsx
echo "  ✓ transaction-list.tsx"

cp wealthfolio-budget/frontend/AddTransactionModal.tsx packages/ui/src/pages/budget/components/add-transaction-modal.tsx
echo "  ✓ add-transaction-modal.tsx"

cp wealthfolio-budget/frontend/BudgetLimits.tsx packages/ui/src/pages/budget/components/budget-limits.tsx
echo "  ✓ budget-limits.tsx"

# Database
cp wealthfolio-budget/database/budget_schema.sql database/schema/
echo "  ✓ budget_schema.sql"

# Create separated components
echo ""
echo "✂️  Creating separated components..."

cat > packages/ui/src/pages/budget/components/category-breakdown.tsx << 'EOF'
import React from 'react';
import { BudgetSummary } from '@/lib/types/budget';

interface CategoryBreakdownProps {
  summary: BudgetSummary | null;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ summary }) => {
  if (!summary || summary.categoryBreakdown.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Category Breakdown
        </h2>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Category Breakdown
      </h2>
      <div className="space-y-4">
        {summary.categoryBreakdown.slice(0, 6).map((item, index) => (
          <div key={index}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xl">{item.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.category.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.transactions} transactions
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  item.category.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.category.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {summary.categoryBreakdown.length > 6 && (
        <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
          Show all categories ({summary.categoryBreakdown.length})
        </button>
      )}
    </div>
  );
};
EOF

cat > packages/ui/src/pages/budget/components/month-selector.tsx << 'EOF'
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  selectedMonth: Date;
  onChange: (date: Date) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({ selectedMonth, onChange }) => {
  const goToPreviousMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onChange(newDate);
  };

  const goToCurrentMonth = () => {
    onChange(new Date());
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return (
      selectedMonth.getMonth() === now.getMonth() &&
      selectedMonth.getFullYear() === now.getFullYear()
    );
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={goToPreviousMonth}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </button>
      
      <div className="flex items-center gap-3">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        
        {!isCurrentMonth() && (
          <button
            onClick={goToCurrentMonth}
            className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Today
          </button>
        )}
      </div>
      
      <button
        onClick={goToNextMonth}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
};
EOF

echo "  ✓ category-breakdown.tsx"
echo "  ✓ month-selector.tsx"

echo ""
echo "✅ Installation complete!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "📋 NEXT STEPS:"
echo "═══════════════════════════════════════════════════"
echo ""
echo "1️⃣  Apply database schema:"
echo "    sqlite3 ./wealthfolio.db < database/schema/budget_schema.sql"
echo ""
echo "2️⃣  Add route (in your router file, e.g., apps/frontend/src/App.tsx):"
echo "    import { BudgetPage } from '@/pages/budget';"
echo "    <Route path=\"/budget\" element={<BudgetPage />} />"
echo ""
echo "3️⃣  Add navigation link (in your sidebar):"
echo "    import { Wallet } from 'lucide-react';"
echo "    <NavLink to=\"/budget\"><Wallet /> Budget</NavLink>"
echo ""
echo "4️⃣  Install dependencies (if needed):"
echo "    npm install recharts lucide-react"
echo ""
echo "5️⃣  Start your app:"
echo "    npm run dev"
echo ""
echo "📚 Full documentation: wealthfolio-budget/README_BUDGET_INTEGRATION.md"
echo ""
