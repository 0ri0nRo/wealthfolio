# 📦 Budget System for Wealthfolio

Complete budget tracking system with income/expense management, charts, and category breakdown.

## 🚀 Quick Start (3 Steps)

### Step 1: Extract
```bash
cd /path/to/your/wealthfolio
unzip budget-system-complete.zip
```

### Step 2: Install
```bash
./install-quick.sh
```

### Step 3: Apply Database
```bash
sqlite3 ./wealthfolio.db < database/schema/budget_schema.sql
```

**Done!** 🎉

## 📂 What's Inside

```
budget-system-complete.zip
├── wealthfolio-budget/
│   ├── frontend/          → React/TypeScript components
│   ├── backend/           → Rust/Tauri API (optional)
│   ├── database/          → SQLite schema
│   ├── README_BUDGET_INTEGRATION.md  → Full documentation
│   ├── QUICK_START.md     → Quick guide
│   └── MANUAL_INSTALL.md  → Manual installation guide
└── install-quick.sh       → Automated installer
```

## ✨ Features

- ✅ Income & Expense tracking
- ✅ Category management with icons
- ✅ Monthly budget limits
- ✅ Interactive charts (pie & bar)
- ✅ Transaction filtering & search
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Mock data included (ready to test)

## 📋 After Installation

1. **Add to router** (e.g., `apps/frontend/src/App.tsx`):
```tsx
import { BudgetPage } from '@/pages/budget';

<Route path="/budget" element={<BudgetPage />} />
```

2. **Add navigation link**:
```tsx
import { Wallet } from 'lucide-react';

<NavLink to="/budget">
  <Wallet className="h-5 w-5" />
  <span>Budget</span>
</NavLink>
```

3. **Start your app**:
```bash
npm run dev
```

Navigate to `/budget` in your browser! 🎊

## 📚 Documentation

- **Quick Start**: `wealthfolio-budget/QUICK_START.md`
- **Full Guide**: `wealthfolio-budget/README_BUDGET_INTEGRATION.md`
- **Manual Install**: `wealthfolio-budget/MANUAL_INSTALL.md`

## 🛠️ Tech Stack

- React 18+ with TypeScript
- Tailwind CSS (dark mode)
- Recharts for charts
- Lucide React icons
- SQLite database
- Rust/Tauri backend (optional)

## 🔧 Requirements

- Node.js & npm
- SQLite3
- Existing Wealthfolio installation

## ❓ Troubleshooting

**Import errors?**
→ Check that paths use `@/lib/types/budget` not `@/types/budget`

**Charts not showing?**
→ Run `npm install recharts lucide-react`

**Database errors?**
→ Make sure you ran the schema: `sqlite3 ./wealthfolio.db < database/schema/budget_schema.sql`

## 📧 Support

Check the documentation files in `wealthfolio-budget/` for detailed help.

---

**Made with ❤️ for Wealthfolio**
