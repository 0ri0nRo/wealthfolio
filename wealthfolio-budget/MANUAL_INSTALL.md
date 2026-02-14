# 📝 Installazione Manuale - Budget per Wealthfolio

Se preferisci installare manualmente invece di usare lo script automatico, segui questi passaggi.

## 🎯 Prerequisiti

- Wealthfolio già clonato e funzionante
- I file di `wealthfolio-budget` scaricati

## 📂 Passo 1: Crea le Cartelle

```bash
cd /path/to/wealthfolio/packages/ui/src

# Crea cartella types in lib
mkdir -p lib/types

# Crea cartella budget e componenti
mkdir -p pages/budget/components
```

## 📋 Passo 2: Copia i File Frontend

### A. Tipi TypeScript

```bash
# Da: wealthfolio-budget/frontend/budget-types.ts
# A:   packages/ui/src/lib/types/budget.ts

cp /path/to/wealthfolio-budget/frontend/budget-types.ts \
   /path/to/wealthfolio/packages/ui/src/lib/types/budget.ts
```

### B. Hook personalizzato

```bash
# Da: wealthfolio-budget/frontend/useBudget.ts
# A:   packages/ui/src/hooks/useBudget.ts

cp /path/to/wealthfolio-budget/frontend/useBudget.ts \
   /path/to/wealthfolio/packages/ui/src/hooks/
```

### C. Pagina principale

```bash
# Da: wealthfolio-budget/frontend/BudgetPage.tsx
# A:   packages/ui/src/pages/budget/index.tsx

cp /path/to/wealthfolio-budget/frontend/BudgetPage.tsx \
   /path/to/wealthfolio/packages/ui/src/pages/budget/index.tsx
```

### D. Componenti (nella cartella components/)

```bash
cd /path/to/wealthfolio/packages/ui/src/pages/budget/components

# Copia tutti i componenti
cp /path/to/wealthfolio-budget/frontend/BudgetChart.tsx ./budget-chart.tsx
cp /path/to/wealthfolio-budget/frontend/TransactionList.tsx ./transaction-list.tsx
cp /path/to/wealthfolio-budget/frontend/AddTransactionModal.tsx ./add-transaction-modal.tsx
cp /path/to/wealthfolio-budget/frontend/BudgetLimits.tsx ./budget-limits.tsx
```

### E. CategoryBreakdown e MonthSelector

Questi sono uniti in un file, devi separarli manualmente:

**Crea:** `packages/ui/src/pages/budget/components/category-breakdown.tsx`

```tsx
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
```

**Crea:** `packages/ui/src/pages/budget/components/month-selector.tsx`

```tsx
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
```

## 🗄️ Passo 3: Database

```bash
# Crea la cartella se non esiste
mkdir -p /path/to/wealthfolio/database/schema

# Copia lo schema
cp /path/to/wealthfolio-budget/database/budget_schema.sql \
   /path/to/wealthfolio/database/schema/

# Applica lo schema al database
cd /path/to/wealthfolio
sqlite3 ./wealthfolio.db < database/schema/budget_schema.sql
```

## 🔧 Passo 4: Aggiusta gli Import

Apri ogni file `.tsx` che hai copiato e modifica gli import:

**Cambia da:**
```typescript
import { BudgetTransaction } from '@/types/budget';
```

**A:**
```typescript
import { BudgetTransaction } from '@/lib/types/budget';
```

**File da modificare:**
- `pages/budget/index.tsx`
- `pages/budget/components/budget-chart.tsx`
- `pages/budget/components/transaction-list.tsx`
- `pages/budget/components/add-transaction-modal.tsx`
- `pages/budget/components/budget-limits.tsx`
- `pages/budget/components/category-breakdown.tsx`

## 🚦 Passo 5: Aggiungi la Route

Nel tuo file di routing principale (probabilmente in `packages/ui/src/`), aggiungi:

```typescript
import { BudgetPage } from '@/pages/budget';

// Nel tuo router:
<Route path="/budget" element={<BudgetPage />} />
```

## 🔗 Passo 6: Aggiungi il Link nella Sidebar

Nel componente della sidebar/navigation:

```tsx
import { Wallet } from 'lucide-react';

<NavLink to="/budget" className="flex items-center gap-2">
  <Wallet className="h-5 w-5" />
  <span>Budget</span>
</NavLink>
```

## ✅ Verifica

Dopo l'installazione, la struttura dovrebbe essere:

```
packages/ui/src/
├── lib/
│   ├── types/
│   │   └── budget.ts           ✓
│   └── ...
├── hooks/
│   └── useBudget.ts            ✓
├── pages/
│   └── budget/
│       ├── index.tsx           ✓
│       └── components/
│           ├── budget-chart.tsx         ✓
│           ├── transaction-list.tsx     ✓
│           ├── add-transaction-modal.tsx ✓
│           ├── budget-limits.tsx        ✓
│           ├── category-breakdown.tsx   ✓
│           └── month-selector.tsx       ✓
```

## 🎉 Fine!

Ora puoi:
1. Avviare il dev server: `npm run dev`
2. Navigare a `/budget`
3. Iniziare a usare il sistema!

## 🆘 Problemi Comuni

### Errore: Cannot find module '@/lib/types/budget'
→ Verifica che il file `lib/types/budget.ts` esista

### Componente non trovato
→ Controlla che i nomi dei file siano in kebab-case (budget-chart.tsx, non BudgetChart.tsx)

### Database error
→ Verifica che lo schema sia stato applicato: `sqlite3 wealthfolio.db ".tables"` dovrebbe mostrare le tabelle budget_*

---

**Preferisci usare lo script automatico?** Vedi `install-budget.sh`
