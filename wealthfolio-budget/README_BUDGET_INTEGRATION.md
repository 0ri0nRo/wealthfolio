# Sistema di Budgeting per Wealthfolio

Questo pacchetto contiene tutti i componenti necessari per aggiungere un sistema completo di budgeting a Wealthfolio.

## 📋 Contenuto

### Database
- `budget_schema.sql` - Schema completo del database con tabelle, indici e trigger

### TypeScript/React
- `budget-types.ts` - Definizioni TypeScript per tutti i tipi
- `BudgetPage.tsx` - Componente principale della pagina Budget
- `BudgetChart.tsx` - Grafici a torta e a barre per visualizzare spese
- `TransactionList.tsx` - Lista filtrata e ordinabile delle transazioni
- `AddTransactionModal.tsx` - Modal per aggiungere/modificare transazioni
- `CategoryBreakdown_MonthSelector.tsx` - Componenti di supporto
- `useBudget.ts` - Hook personalizzati per gestire lo state

### Backend (Rust/Tauri)
- `budget_rust_api.rs` - Implementazione completa delle API in Rust

## 🚀 Guida all'Integrazione

### 1. Database Setup

Esegui lo schema SQL per creare le tabelle necessarie:

```bash
sqlite3 /path/to/wealthfolio.db < budget_schema.sql
```

### 2. TypeScript/Frontend

#### 2.1 Copia i file TypeScript

```
src/
├── types/
│   └── budget.ts                    # Copia da budget-types.ts
├── hooks/
│   └── useBudget.ts                 # Copia da useBudget.ts
└── pages/
    └── Budget/
        ├── BudgetPage.tsx           # Componente principale
        └── components/
            ├── BudgetChart.tsx
            ├── TransactionList.tsx
            ├── AddTransactionModal.tsx
            ├── CategoryBreakdown.tsx
            └── MonthSelector.tsx
```

#### 2.2 Aggiungi la route

Nel tuo router (es. `src/App.tsx` o `src/routes.tsx`):

```tsx
import { BudgetPage } from '@/pages/Budget/BudgetPage';

// Aggiungi la route
<Route path="/budget" element={<BudgetPage />} />
```

#### 2.3 Aggiungi il link nella sidebar

```tsx
import { Wallet } from 'lucide-react';

// Nel tuo componente Sidebar
<NavLink to="/budget">
  <Wallet className="h-5 w-5" />
  <span>Budget</span>
</NavLink>
```

### 3. Backend (Rust/Tauri)

#### 3.1 Aggiungi il modulo budget

Crea il file `src-tauri/src/budget/mod.rs` con il contenuto di `budget_rust_api.rs`.

#### 3.2 Registra il modulo in `src-tauri/src/main.rs`

```rust
mod budget;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... altri handlers esistenti
            budget::get_budget_categories,
            budget::get_budget_transactions,
            budget::create_budget_transaction,
            budget::update_budget_transaction,
            budget::delete_budget_transaction,
            budget::get_budget_summary,
            budget::create_budget_category,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 3.3 Aggiorna il database connection state

Assicurati che il tuo `Connection` sia disponibile come stato Tauri:

```rust
use rusqlite::Connection;

fn main() {
    let conn = Connection::open("wealthfolio.db").unwrap();
    
    tauri::Builder::default()
        .manage(conn)
        // ... resto della configurazione
}
```

### 4. Integrazione API nel Frontend

Aggiorna `useBudget.ts` per usare le vere chiamate Tauri invece dei mock:

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Esempio:
const fetchData = useCallback(async () => {
  const [txns, cats, sum] = await Promise.all([
    invoke<BudgetTransaction[]>('get_budget_transactions', {
      month: month.getMonth() + 1,
      year: month.getFullYear(),
    }),
    invoke<BudgetCategory[]>('get_budget_categories'),
    invoke<BudgetSummary>('get_budget_summary', {
      month: month.getMonth() + 1,
      year: month.getFullYear(),
    }),
  ]);
  
  setTransactions(txns);
  setCategories(cats);
  setSummary(sum);
}, [month]);
```

## 🎨 Personalizzazione

### Colori e Temi

I componenti usano Tailwind CSS con supporto dark mode. Puoi personalizzare:

```tsx
// Cambia i colori principali
const colors = {
  income: 'bg-green-600',
  expense: 'bg-red-600',
  primary: 'bg-blue-600',
};
```

### Icone delle Categorie

Puoi cambiare le icone emoji di default nel database:

```sql
UPDATE budget_categories 
SET icon = '🎯' 
WHERE name = 'Obiettivi';
```

### Grafici

I grafici usano Recharts. Personalizza in `BudgetChart.tsx`:

```tsx
// Cambia il numero massimo di categorie visualizzate
.slice(0, 8); // <- cambia questo numero

// Cambia i colori del bar chart
<Bar dataKey="income" fill="#10b981" />
<Bar dataKey="expenses" fill="#ef4444" />
```

## 📊 Funzionalità Implementate

### ✅ Transazioni
- [x] Creazione transazioni (entrate/uscite)
- [x] Modifica transazioni
- [x] Eliminazione transazioni
- [x] Filtro per tipo, data, categoria
- [x] Ricerca testuale
- [x] Ordinamento
- [x] Supporto transazioni ricorrenti

### ✅ Categorie
- [x] Categorie predefinite
- [x] Creazione nuove categorie
- [x] Icone personalizzabili
- [x] Colori personalizzabili
- [x] Categorie gerarchiche (parent/child)

### ✅ Visualizzazioni
- [x] Dashboard con metriche principali
- [x] Grafico a torta per spese per categoria
- [x] Grafico a barre entrate vs uscite
- [x] Breakdown categorie con percentuali
- [x] Navigazione mese per mese

### ✅ Funzionalità Avanzate
- [x] Dark mode
- [x] Responsive design
- [x] Tags per transazioni
- [x] Note per transazioni
- [x] Validazione form

## 🔄 Funzionalità Future (da implementare)

### Budget Limits
```typescript
// Imposta un limite mensile per categoria
interface BudgetLimit {
  categoryId: string;
  month: number;
  year: number;
  limitAmount: number;
}
```

### Export/Import
```typescript
// Esporta transazioni in CSV/Excel
exportTransactions(format: 'csv' | 'xlsx', filters: BudgetFilters)

// Importa transazioni da CSV
importTransactions(file: File)
```

### Report Avanzati
```typescript
// Confronto anno su anno
getYearOverYearComparison(year1: number, year2: number)

// Trend analysis
getTrendAnalysis(startDate: string, endDate: string)
```

### Notifiche
```typescript
// Notifica quando si supera un budget
notifyBudgetExceeded(categoryId: string, amount: number)
```

## 🐛 Testing

### Test Unitari (esempio con Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { useFilteredTransactions } from '@/hooks/useBudget';

describe('useFilteredTransactions', () => {
  it('should filter by transaction type', () => {
    const transactions = [
      { type: 'income', amount: 100 },
      { type: 'expense', amount: 50 },
    ];
    
    const filtered = useFilteredTransactions(transactions, { type: 'income' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('income');
  });
});
```

## 📦 Dipendenze Richieste

Assicurati di avere queste dipendenze nel tuo `package.json`:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "lucide-react": "^0.263.1",
    "recharts": "^2.5.0",
    "@tauri-apps/api": "^1.5.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.0"
  }
}
```

Per il backend Rust (`Cargo.toml`):

```toml
[dependencies]
tauri = { version = "1.5", features = ["api-all"] }
rusqlite = { version = "0.30", features = ["bundled"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
chrono = { version = "0.4", features = ["serde"] }
```

## 🔒 Sicurezza

### SQL Injection Prevention
Il codice usa prepared statements ovunque:
```rust
conn.execute(
    "SELECT * FROM budget_transactions WHERE id = ?1",
    params![id],
)
```

### Input Validation
Validazione sia client-side che server-side:
```typescript
const validate = () => {
  if (amount <= 0) return false;
  if (!categoryId) return false;
  return true;
};
```

## 📝 Note Importanti

1. **Performance**: Per database con migliaia di transazioni, considera l'aggiunta di paginazione
2. **Backup**: Implementa un sistema di backup automatico del database
3. **Migrazioni**: Usa un sistema di migrazioni per aggiornamenti futuri dello schema
4. **Internazionalizzazione**: Il codice usa formattazione italiana, adattalo alle tue esigenze

## 🤝 Contribuire

Se vuoi estendere questo sistema:

1. Aggiungi nuove funzionalità nel modulo appropriato
2. Mantieni la separazione tra UI e logica di business
3. Documenta le modifiche
4. Aggiungi test

## 📞 Supporto

Per problemi o domande:
1. Controlla che lo schema DB sia applicato correttamente
2. Verifica che le route Tauri siano registrate
3. Controlla la console per errori JavaScript/TypeScript
4. Verifica i log Rust per errori backend

## Struttura File Completa

```
wealthfolio/
├── src/
│   ├── types/
│   │   └── budget.ts
│   ├── hooks/
│   │   └── useBudget.ts
│   ├── pages/
│   │   └── Budget/
│   │       ├── BudgetPage.tsx
│   │       └── components/
│   │           ├── BudgetChart.tsx
│   │           ├── TransactionList.tsx
│   │           ├── AddTransactionModal.tsx
│   │           ├── CategoryBreakdown.tsx
│   │           └── MonthSelector.tsx
├── src-tauri/
│   ├── src/
│   │   ├── budget/
│   │   │   └── mod.rs
│   │   └── main.rs
│   └── Cargo.toml
└── budget_schema.sql
```

Buon coding! 🚀
