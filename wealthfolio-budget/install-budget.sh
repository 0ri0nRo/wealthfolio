#!/bin/bash

# Script di installazione Budget per Wealthfolio
# Uso: ./install-budget.sh /path/to/wealthfolio /path/to/wealthfolio-budget

set -e  # Esci se c'è un errore

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verifica argomenti
if [ "$#" -ne 2 ]; then
    echo -e "${RED}Uso: $0 /path/to/wealthfolio /path/to/wealthfolio-budget${NC}"
    exit 1
fi

WEALTHFOLIO_DIR="$1"
BUDGET_FILES_DIR="$2"

# Verifica che le directory esistano
if [ ! -d "$WEALTHFOLIO_DIR" ]; then
    echo -e "${RED}Errore: Directory Wealthfolio non trovata: $WEALTHFOLIO_DIR${NC}"
    exit 1
fi

if [ ! -d "$BUDGET_FILES_DIR" ]; then
    echo -e "${RED}Errore: Directory budget files non trovata: $BUDGET_FILES_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Installazione Budget per Wealthfolio${NC}"
echo ""

# Directory di destinazione
UI_SRC="$WEALTHFOLIO_DIR/packages/ui/src"

# Verifica che la directory UI esista
if [ ! -d "$UI_SRC" ]; then
    echo -e "${RED}Errore: Directory packages/ui/src non trovata${NC}"
    exit 1
fi

echo -e "${YELLOW}📁 Creazione struttura cartelle...${NC}"

# 1. Crea le cartelle necessarie
mkdir -p "$UI_SRC/lib/types"
mkdir -p "$UI_SRC/pages/budget/components"
mkdir -p "$WEALTHFOLIO_DIR/database/schema"

echo -e "${GREEN}✓ Cartelle create${NC}"

echo -e "${YELLOW}📄 Copia file frontend...${NC}"

# 2. Copia i file TypeScript/React
cp "$BUDGET_FILES_DIR/frontend/budget-types.ts" "$UI_SRC/lib/types/budget.ts"
echo "  ✓ budget.ts -> lib/types/"

cp "$BUDGET_FILES_DIR/frontend/useBudget.ts" "$UI_SRC/hooks/"
echo "  ✓ useBudget.ts -> hooks/"

cp "$BUDGET_FILES_DIR/frontend/BudgetPage.tsx" "$UI_SRC/pages/budget/index.tsx"
echo "  ✓ index.tsx -> pages/budget/"

cp "$BUDGET_FILES_DIR/frontend/BudgetChart.tsx" "$UI_SRC/pages/budget/components/budget-chart.tsx"
echo "  ✓ budget-chart.tsx -> pages/budget/components/"

cp "$BUDGET_FILES_DIR/frontend/TransactionList.tsx" "$UI_SRC/pages/budget/components/transaction-list.tsx"
echo "  ✓ transaction-list.tsx -> pages/budget/components/"

cp "$BUDGET_FILES_DIR/frontend/AddTransactionModal.tsx" "$UI_SRC/pages/budget/components/add-transaction-modal.tsx"
echo "  ✓ add-transaction-modal.tsx -> pages/budget/components/"

cp "$BUDGET_FILES_DIR/frontend/BudgetLimits.tsx" "$UI_SRC/pages/budget/components/budget-limits.tsx"
echo "  ✓ budget-limits.tsx -> pages/budget/components/"

echo -e "${GREEN}✓ File frontend copiati${NC}"

echo -e "${YELLOW}🗄️  Copia schema database...${NC}"

# 3. Copia lo schema database
cp "$BUDGET_FILES_DIR/database/budget_schema.sql" "$WEALTHFOLIO_DIR/database/schema/"
echo "  ✓ budget_schema.sql -> database/schema/"

echo -e "${GREEN}✓ Schema database copiato${NC}"

# 4. Separazione del file CategoryBreakdown_MonthSelector.tsx
echo -e "${YELLOW}✂️  Separazione componenti CategoryBreakdown e MonthSelector...${NC}"

# Crea CategoryBreakdown.tsx
cat > "$UI_SRC/pages/budget/components/category-breakdown.tsx" << 'EOF'
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
          Ripartizione per Categoria
        </h2>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Ripartizione per Categoria
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
                    {item.transactions} transazioni
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  item.category.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  €{item.total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
          Mostra tutte le categorie ({summary.categoryBreakdown.length})
        </button>
      )}
    </div>
  );
};
EOF

# Crea MonthSelector.tsx
cat > "$UI_SRC/pages/budget/components/month-selector.tsx" << 'EOF'
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
          {selectedMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </h3>
        
        {!isCurrentMonth() && (
          <button
            onClick={goToCurrentMonth}
            className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Oggi
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

echo "  ✓ category-breakdown.tsx creato"
echo "  ✓ month-selector.tsx creato"

echo -e "${GREEN}✓ Componenti separati${NC}"

echo ""
echo -e "${GREEN}✅ Installazione completata con successo!${NC}"
echo ""
echo -e "${YELLOW}📋 Prossimi passi:${NC}"
echo ""
echo "1. Applica lo schema database:"
echo "   cd $WEALTHFOLIO_DIR"
echo "   sqlite3 ./wealthfolio.db < database/schema/budget_schema.sql"
echo ""
echo "2. Aggiungi la route nel tuo router (es. App.tsx):"
echo "   import { BudgetPage } from '@/pages/budget';"
echo "   <Route path=\"/budget\" element={<BudgetPage />} />"
echo ""
echo "3. Aggiungi il link nella sidebar:"
echo "   import { Wallet } from 'lucide-react';"
echo "   <NavLink to=\"/budget\"><Wallet /> Budget</NavLink>"
echo ""
echo "4. Configura il backend (vedi README_BUDGET_INTEGRATION.md)"
echo ""
echo -e "${GREEN}📚 Documentazione completa in: $BUDGET_FILES_DIR/README_BUDGET_INTEGRATION.md${NC}"
