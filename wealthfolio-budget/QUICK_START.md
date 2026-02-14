# 🚀 Guida Rapida - Sistema Budget per Wealthfolio

## 📦 Cosa c'è nella cartella

```
wealthfolio-budget/
├── README_BUDGET_INTEGRATION.md  ← Documentazione completa
├── database/
│   └── budget_schema.sql         ← Schema database SQLite
├── frontend/
│   ├── budget-types.ts           ← Definizioni TypeScript
│   ├── useBudget.ts              ← Hook React personalizzati
│   ├── BudgetPage.tsx            ← Pagina principale
│   ├── BudgetChart.tsx           ← Grafici
│   ├── TransactionList.tsx       ← Lista transazioni
│   ├── AddTransactionModal.tsx   ← Modal aggiungi/modifica
│   ├── BudgetLimits.tsx          ← Gestione limiti budget
│   └── CategoryBreakdown_MonthSelector.tsx ← Componenti utility
└── backend/
    └── budget_rust_api.rs        ← API Rust/Tauri
```

## ⚡ Installazione Veloce (5 minuti)

### 1️⃣ Database (30 secondi)

```bash
cd /path/to/wealthfolio
sqlite3 ./wealthfolio.db < database/budget_schema.sql
```

✅ Questo crea tutte le tabelle e inserisce categorie di default

### 2️⃣ Frontend (2 minuti)

```bash
# Copia i file nella struttura corretta
cp frontend/budget-types.ts src/types/
cp frontend/useBudget.ts src/hooks/

# Crea la cartella Budget e copia i componenti
mkdir -p src/pages/Budget/components
cp frontend/BudgetPage.tsx src/pages/Budget/
cp frontend/BudgetChart.tsx src/pages/Budget/components/
cp frontend/TransactionList.tsx src/pages/Budget/components/
cp frontend/AddTransactionModal.tsx src/pages/Budget/components/
cp frontend/BudgetLimits.tsx src/pages/Budget/components/
```

Separa i componenti da `CategoryBreakdown_MonthSelector.tsx`:
```bash
# Crea due file separati
# CategoryBreakdown.tsx e MonthSelector.tsx
# (vedi istruzioni dettagliate nel README principale)
```

### 3️⃣ Aggiungi la Route (1 minuto)

Nel tuo file di routing (es. `src/App.tsx`):

```typescript
import { BudgetPage } from '@/pages/Budget/BudgetPage';

// Aggiungi questa route
<Route path="/budget" element={<BudgetPage />} />
```

Nella sidebar:

```tsx
import { Wallet } from 'lucide-react';

<NavLink to="/budget">
  <Wallet className="h-5 w-5" />
  Budget
</NavLink>
```

### 4️⃣ Backend Rust (2 minuti)

```bash
# Copia il modulo
mkdir -p src-tauri/src/budget
cp backend/budget_rust_api.rs src-tauri/src/budget/mod.rs
```

In `src-tauri/src/main.rs`:

```rust
mod budget;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... handlers esistenti ...
            budget::get_budget_categories,
            budget::get_budget_transactions,
            budget::create_budget_transaction,
            budget::update_budget_transaction,
            budget::delete_budget_transaction,
            budget::get_budget_summary,
            budget::create_budget_category,
        ])
        // ... resto configurazione
}
```

### 5️⃣ Attiva le API (1 minuto)

In `frontend/useBudget.ts`, decommenta le chiamate Tauri:

```typescript
// Cambia da:
// Mock data per sviluppo
const mockSummary = {...}

// A:
const [txns, cats, sum] = await Promise.all([
  invoke('get_budget_transactions', {
    month: month.getMonth() + 1,
    year: month.getFullYear(),
  }),
  invoke('get_budget_categories'),
  invoke('get_budget_summary', {
    month: month.getMonth() + 1,
    year: month.getFullYear(),
  }),
]);
```

## 🎯 Cosa otterrai

### ✨ Funzionalità principali

1. **Dashboard Budget** con:
   - Totale entrate del mese
   - Totale uscite del mese
   - Bilancio (entrate - uscite)
   - Selezione mese/anno

2. **Gestione Transazioni**:
   - Aggiunta rapida entrate/uscite
   - Categorie con icone ed emoji
   - Filtri per tipo, data, categoria
   - Ricerca testuale
   - Modifica ed eliminazione

3. **Visualizzazioni**:
   - Grafico a torta spese per categoria
   - Grafico a barre entrate vs uscite ultimi 6 mesi
   - Progress bar per categorie

4. **Limiti Budget**:
   - Imposta limiti mensili per categoria
   - Alert quando superi l'80% del limite
   - Visualizzazione percentuale utilizzo

## 📊 Screenshot delle funzionalità

```
┌─────────────────────────────────────────┐
│  Budget - Febbraio 2026                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Entrate │ │  Uscite │ │ Bilancio│   │
│  │ €3,500  │ │ €2,300  │ │ €1,200  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                          │
│  📊 Grafici         📋 Categorie        │
│  [Torta spese]     [Lista breakdown]    │
│                                          │
│  📝 Transazioni Recenti                 │
│  🛒 Alimentari       -€50.00            │
│  💼 Stipendio        +€3,500.00         │
│  🚗 Benzina          -€80.00            │
└─────────────────────────────────────────┘
```

## 🎨 Personalizzazioni Veloci

### Cambia i colori principali

In `BudgetPage.tsx`:

```tsx
// Entrate verdi → blu
className="text-green-600" → className="text-blue-600"

// Uscite rosse → arancione
className="text-red-600" → className="text-orange-600"
```

### Aggiungi nuove categorie

Inserisci nel database:

```sql
INSERT INTO budget_categories (name, type, color, icon) VALUES
('Viaggi', 'expense', '#3b82f6', '✈️'),
('Regali', 'expense', '#ec4899', '🎁'),
('Investimenti', 'income', '#8b5cf6', '📈');
```

### Cambia il numero di categorie nei grafici

In `BudgetChart.tsx`:

```tsx
.slice(0, 8) // Mostra top 8 categorie
```

## 🐛 Risoluzione Problemi Comuni

### Errore: "Table already exists"
✅ Normale se ri-esegui lo schema. Il database ha già le tabelle.

### Transazioni non compaiono
✅ Verifica che:
1. Le API Tauri siano registrate
2. Il database sia nella path corretta
3. La console non mostri errori

### Grafici non visualizzano dati
✅ Installa dipendenze:
```bash
npm install recharts lucide-react
```

### Errori TypeScript
✅ Verifica le import:
```typescript
import { BudgetTransaction } from '@/types/budget';
```

## 📚 Prossimi Passi

1. **Leggi il README completo** per funzionalità avanzate
2. **Testa con dati di esempio** per familiarizzare
3. **Personalizza** categorie e colori
4. **Aggiungi** funzionalità come export CSV o report

## 🔗 Link Utili

- README completo: `README_BUDGET_INTEGRATION.md`
- Schema DB: `database/budget_schema.sql`
- API Docs: Commenti in `backend/budget_rust_api.rs`

## 💡 Tips

- Usa `Cmd/Ctrl + K` per ricerca rapida transazioni
- Clicca sui grafici per drill-down (da implementare)
- Esporta dati mensili per Excel (da implementare)
- Imposta budget ricorrenti per risparmiare tempo

---

**Fatto!** 🎉 Ora hai un sistema di budgeting completo integrato in Wealthfolio!

Per domande o problemi, consulta il README completo o i commenti nel codice.
