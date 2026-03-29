// src/pages/Budget/index.tsx
import { useBalancePrivacy } from '@/hooks/use-balance-privacy';
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/lib/types/budget';
import { RecurringEntryAsTx, RecurringExpense, isRecurringActiveInMonth } from '@/lib/types/recurring';
import {
  BarChart2, ChevronLeft, ChevronRight, Copy, Edit2, Plus,
  RefreshCw, Search, Settings, SlidersHorizontal, Tag,
  Trash2, TrendingDown, TrendingUp, UtensilsCrossed, Wallet, X,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AddTransactionModal } from "./components/add-transaction-modal";
import { BudgetChart } from "./components/budget-chart";
import { BudgetInsights } from "./components/budget-insights";
import { ExportModal } from "./components/ExportModal";
import { ManageCategoriesModal } from "./components/ManageCategoriesModal";
import { RecurringExpenseCard } from "./components/recurring-expense-card";
import { RecurringExpenseModal } from "./components/recurring-expense-modal";
import { RecurringExpensesTable } from "./components/recurring-expenses-table";
import { YearlyStats } from "./components/YearlyStats";

// ── Helpers ───────────────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

const isMealVoucher = (t: BudgetTransaction | RecurringEntryAsTx) => {
  if ('category' in t) return (t as BudgetTransaction).category?.name?.toLowerCase().includes('buoni pasto') ?? false;
  return false;
};

const isInvestmentTx = (t: BudgetTransaction) => {
  if (!t.category) return false;
  const n = t.category.name.toLowerCase();
  return n.includes('invest') || n.includes('crypto') || n.includes('etf') || n.includes('stock');
};

const fmtEur = (n: number) =>
  `€${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `€${(abs / 1000).toFixed(1)}k` : `€${abs.toFixed(0)}`;
  return n < 0 ? `-${s}` : s;
};

type ActiveTab = 'overview' | 'transactions' | 'yearly' | 'recurring';

const RECURRING_KEY = 'budget_recurring_ids';
function loadRecurring(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(RECURRING_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function saveRecurring(s: Set<string>) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify([...s]));
}

// ── Main component ────────────────────────────────────────────────────────────
export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showGearMenu, setShowGearMenu] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const gearRef     = useRef<HTMLDivElement>(null);
  const isMobile    = useIsMobile();
  const tabLayoutId = useId();

  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState<'all' | 'income' | 'expense'>('all');
  const [filterCatId,  setFilterCatId]  = useState<number | null>(null);
  const [filterAmtMin, setFilterAmtMin] = useState('');
  const [filterAmtMax, setFilterAmtMax] = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  const [recurringIds, setRecurringIds] = useState<Set<string>>(loadRecurring);
  const toggleRecurring = (id: string) => {
    setRecurringIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveRecurring(next);
      return next;
    });
  };

  const TAB_ORDER: ActiveTab[] = ['overview', 'transactions', 'yearly', 'recurring'];
  const swipeX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { swipeX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (swipeX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = TAB_ORDER.indexOf(activeTab);
    if (dx < 0 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
    if (dx > 0 && idx > 0)                    setActiveTab(TAB_ORDER[idx - 1]);
  };

  const { isBalanceHidden, toggleBalanceVisibility } = useBalancePrivacy();

  const {
    transactions, allTransactions, categories, summary, loading, error,
    createTransaction, deleteTransaction, updateTransaction, refresh,
    createCategory, updateCategory, deleteCategory,
    recurringExpenses, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
    recurringEntryTxns, deleteRecurringEntry,
  } = useBudget(selectedMonth);

  useEffect(() => {
    if (!showGearMenu) return;
    const h = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setShowGearMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showGearMenu]);

  // ── Derived values ────────────────────────────────────────────────────────
  const txList        = transactions    || [];
  const allTxList     = allTransactions || [];
  const recurringList = recurringExpenses || [];
  const entryTxns     = recurringEntryTxns || [];

  // Meal vouchers (from regular transactions only)
  const bpIncomeMonth = txList.filter(t => t.type === 'income'  && isMealVoucher(t)).reduce((s, t) => s + t.amount, 0);
  const bpIncomeAll   = allTxList.filter(t => t.type === 'income'  && isMealVoucher(t)).reduce((s, t) => s + t.amount, 0);
  const bpExpensesAll = allTxList.filter(t => t.type === 'expense' && isMealVoucher(t)).reduce((s, t) => s + t.amount, 0);
  const bpBalance     = bpIncomeAll - bpExpensesAll;

  const investments = txList.filter(t => t.type === 'expense' && isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const totalIncome = summary?.totalIncome ?? 0;

  // Regular expenses: no BP, no investments
  const txExpensesTotal = txList
    .filter(t => t.type === 'expense' && !isInvestmentTx(t))
    .reduce((s, t) => s + t.amount, 0);

  // Recurring expenses for this month = sum of entry amounts
  const recurringMonthlyTotal = entryTxns.reduce((s, e) => s + e.amount, 0);

  // Total expenses = manual (no investments) + recurring entries
  const expensesTotal = txExpensesTotal + recurringMonthlyTotal;

  // ── Prev month deltas ─────────────────────────────────────────────────────
  const prevMonth = useMemo(() => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, [selectedMonth]);

  const prevMonthTx = useMemo(() =>
    allTxList.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
    }),
    [allTxList, prevMonth]
  );

  const prevIncome     = prevMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevTxExpenses = prevMonthTx.filter(t => t.type === 'expense' && !isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const prevSavings    = prevMonthTx.filter(t => t.type === 'expense' && isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);

  const prevRecurringTotal = useMemo(() =>
    recurringList
      .filter(e => isRecurringActiveInMonth(e, prevMonth.getFullYear(), prevMonth.getMonth() + 1))
      .reduce((s, e) => s + e.amount, 0),
    [recurringList, prevMonth]
  );

  const prevExpenses = prevTxExpenses + prevRecurringTotal;

  // ── Cash balance (solo mese corrente, nessun cumulativo) ──────────────────
  //
  // Cash = Entrate (no BP) − Spese normali (no BP, no invest.) − Ricorrenti − Investimenti
  //
  const currentMonthIncome = totalIncome - bpIncomeMonth;

  const currentMonthExpenses = txList
    .filter(t => t.type === 'expense' && !isMealVoucher(t) && !isInvestmentTx(t))
    .reduce((s, t) => s + t.amount, 0);

  const cashBalance = currentMonthIncome
    - currentMonthExpenses
    - recurringMonthlyTotal
    - investments;

  // ── Combined transaction list (manual + recurring entries) ─────────────────
  const combinedTxList = useMemo(() => {
    const entryAsAny = entryTxns.map(e => ({
      ...e,
      categoryId: e.categoryId,
      category:   categories.find(c => Number(c.id) === e.categoryId),
    }));
    return [...txList, ...entryAsAny as any[]].sort((a, b) => b.date.localeCompare(a.date));
  }, [txList, entryTxns, categories]);

  // ── Recurring entries shaped as BudgetTransaction for charts/insights ──────
  const entryTxnsAsTx = useMemo(() =>
    entryTxns.map(e => ({
      ...e,
      type: 'expense' as const,
      category: categories.find(c => Number(c.id) === e.categoryId),
    })),
    [entryTxns, categories]
  );

  // ── Filtered combined transactions ────────────────────────────────────────
  const filteredTx = useMemo(() => {
    let r = combinedTxList;
    if (search) r = r.filter((t: any) =>
      [t.description, t.notes, t.category?.name]
        .some((s: any) => s?.toLowerCase().includes(search.toLowerCase()))
    );
    if (filterType !== 'all') r = r.filter((t: any) => t.type === filterType);
    if (filterCatId)          r = r.filter((t: any) => Number(t.category?.id ?? t.categoryId) === filterCatId);
    const mn = parseFloat(filterAmtMin); if (!isNaN(mn)) r = r.filter((t: any) => t.amount >= mn);
    const mx = parseFloat(filterAmtMax); if (!isNaN(mx)) r = r.filter((t: any) => t.amount <= mx);
    return r;
  }, [combinedTxList, search, filterType, filterCatId, filterAmtMin, filterAmtMax]);

  const hasActiveFilter = !!(search || filterType !== 'all' || filterCatId || filterAmtMin || filterAmtMax);
  const clearFilters = () => {
    setSearch(''); setFilterType('all'); setFilterCatId(null);
    setFilterAmtMin(''); setFilterAmtMax('');
  };

  // ── Fixed vs discretionary ────────────────────────────────────────────────
  const manualRecurringFixed = txList.filter(t => recurringIds.has(String(t.id)) && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalRecurringFixed  = manualRecurringFixed + recurringMonthlyTotal;
  const discretionary        = expensesTotal - totalRecurringFixed;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddTransaction = async (transaction: Partial<BudgetTransaction>) => {
    try {
      if (editingTransaction) {
        await updateTransaction(Number(editingTransaction.id), transaction);
      } else {
        await createTransaction({
          categoryId:  transaction.categoryId!,
          amount:      transaction.amount!,
          type:        transaction.type!,
          description: transaction.description!,
          date:        transaction.date!,
          notes:       transaction.notes,
        });
      }
      setShowAddModal(false); setEditingTransaction(null);
    } catch (err) {
      alert('Error saving transaction: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDuplicate = async (t: BudgetTransaction) => {
    try {
      await createTransaction({
        categoryId:  t.categoryId ?? (t.category?.id as number),
        amount:      t.amount, type: t.type,
        description: `${t.description} (copy)`, date: t.date, notes: t.notes,
      });
    } catch {}
  };

  const handleDeleteTransaction = async (id: string | number) => {
    if (typeof id === 'string' && id.startsWith('rec-')) {
      const entryId = id.replace('rec-', '');
      try { await deleteRecurringEntry(entryId); } catch {}
    } else {
      try { await deleteTransaction(id); } catch {}
    }
  };

  const handleAddRecurringExpense = async (expense: Partial<RecurringExpense>) => {
    try {
      const categoryId = typeof expense.categoryId === 'string'
        ? parseInt(expense.categoryId, 10) : (expense.categoryId || 0);
      const payload: Partial<RecurringExpense> = {
        categoryId, amount: expense.amount, description: expense.description,
        frequency: expense.frequency, customDays: expense.customDays,
        startDate: expense.startDate, endDate: expense.endDate || null,
        notes: expense.notes, isActive: true,
      };
      if (editingRecurring) await updateRecurringExpense(Number(editingRecurring.id), payload);
      else await createRecurringExpense(payload);
      setShowRecurringModal(false); setEditingRecurring(null);
    } catch (err) {
      alert('Error saving recurring expense: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeleteRecurringExpense = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this recurring expense?')) return;
    try { await deleteRecurringExpense(id); }
    catch (err) { console.error('Error deleting recurring expense:', err); }
  };

  const handleDuplicateRecurringExpense = async (expense: RecurringExpense) => {
    try {
      await createRecurringExpense({
        categoryId: expense.categoryId, amount: expense.amount,
        description: `${expense.description} (copy)`, frequency: expense.frequency,
        customDays: expense.customDays, startDate: new Date().toISOString().split('T')[0],
        endDate: null, notes: expense.notes, isActive: true,
      });
    } catch (err) { console.error('Error duplicating recurring expense:', err); }
  };

  const goToPrevMonth = () => { const d = new Date(selectedMonth); d.setMonth(d.getMonth() - 1); setSelectedMonth(d); };
  const goToNextMonth = () => { const d = new Date(selectedMonth); d.setMonth(d.getMonth() + 1); setSelectedMonth(d); };
  const isCurrentMonth =
    selectedMonth.getMonth()    === new Date().getMonth() &&
    selectedMonth.getFullYear() === new Date().getFullYear();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid var(--foreground)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
      <div style={{ textAlign: 'center', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--destructive)', fontWeight: 600, marginBottom: 8 }}>Error loading budget data</p>
        <p style={{ color: 'var(--muted-foreground)', marginBottom: 24 }}>{error}</p>
        <button onClick={refresh} style={{ padding: '8px 20px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );

  interface StatCard { label: string; value: number; delta?: number; icon: React.ReactNode; iconColor: string; iconBg: string; }

  const statCards: StatCard[] = [
    { label: 'Income',        value: totalIncome,   delta: prevIncome   > 0 ? totalIncome   - prevIncome   : undefined, icon: <TrendingUp size={16} />,    iconColor: 'var(--success)',          iconBg: 'color-mix(in srgb, var(--success) 12%, var(--background))' },
    { label: 'Expenses',      value: expensesTotal, delta: prevExpenses > 0 ? expensesTotal - prevExpenses : undefined, icon: <TrendingDown size={16} />,  iconColor: 'var(--destructive)',      iconBg: 'color-mix(in srgb, var(--destructive) 12%, var(--background))' },
    { label: 'Savings',       value: investments,   delta: prevSavings  > 0 ? investments   - prevSavings  : undefined, icon: <TrendingUp size={16} />,    iconColor: 'var(--color-purple-600)', iconBg: 'color-mix(in srgb, var(--color-purple-600) 12%, var(--background))' },
    { label: 'Cash',          value: cashBalance,   icon: <Wallet size={16} />,          iconColor: cashBalance >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)',    iconBg: cashBalance >= 0 ? 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))' },
    { label: 'Meal Vouchers', value: bpBalance,     icon: <UtensilsCrossed size={16} />, iconColor: bpBalance >= 0 ? 'var(--color-orange-400)' : 'var(--destructive)', iconBg: bpBalance >= 0 ? 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))' },
  ];

  const TABS: [ActiveTab, string][] = [
    ['overview',     'Overview'],
    ['transactions', isMobile ? 'Trans.' : 'Transactions'],
    ['yearly',       isMobile ? 'Ann.' : 'Annual'],
    ['recurring',    isMobile ? 'Rec.' : 'Recurring'],
  ];

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ minHeight: '100vh', background: 'var(--background)' }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: isMobile ? '0.75rem' : '0.75rem 1rem' }}>
          <nav style={{ display: 'inline-flex', alignItems: 'center', background: 'color-mix(in srgb, var(--muted) 60%, transparent)', borderRadius: '999px', padding: '3px', gap: '2px' }}>
            {TABS.map(([key, label]) => {
              const isActive = activeTab === key;
              return (
                <button key={key} type="button" onClick={() => setActiveTab(key)}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: isMobile ? '4px 8px' : '5px 14px', borderRadius: '999px', border: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent', userSelect: 'none', transition: 'color 0.2s' }}>
                  {isActive && (
                    <motion.div layoutId={`budget-tab-${tabLayoutId}`}
                      style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: 'var(--background)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                      initial={false} transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                  )}
                  <span style={{ position: 'relative', zIndex: 10 }}>{label}</span>
                </button>
              );
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeTab !== 'yearly' && activeTab !== 'recurring' && !isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button onClick={goToPrevMonth} style={{ width: 28, height: 28, border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><ChevronLeft size={15} /></button>
                <button onClick={() => setSelectedMonth(new Date())} style={{ padding: '4px 10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent', background: isCurrentMonth ? 'var(--muted)' : 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))', color: isCurrentMonth ? 'var(--foreground)' : 'var(--color-orange-400)' }}>
                  {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </button>
                <button onClick={goToNextMonth} style={{ width: 28, height: 28, border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><ChevronRight size={15} /></button>
              </div>
            )}

            <div ref={gearRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowGearMenu(v => !v)}
                style={{ width: 34, height: 34, border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent', background: showGearMenu || isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', color: showGearMenu || isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)' }}>
                <Settings size={15} />
              </button>
              {showGearMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 50, animation: 'dropIn 0.16s cubic-bezier(.34,1.4,.64,1) forwards' }}>
                  <div onClick={toggleBalanceVisibility}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>{isBalanceHidden ? '👁️' : '🙈'}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Hide balances</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>{isBalanceHidden ? 'Active across the app' : 'Tap to activate'}</p>
                    </div>
                    <div style={{ width: 36, height: 20, borderRadius: '999px', flexShrink: 0, background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 2, left: isBalanceHidden ? 'calc(100% - 18px)' : '2px', width: 16, height: 16, borderRadius: '50%', background: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                  <div onClick={() => { setShowCategoriesModal(true); setShowGearMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Tag size={14} color="var(--muted-foreground)" /></div>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Categories</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>Manage &amp; edit</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (activeTab === 'recurring') { setEditingRecurring(null); setShowRecurringModal(true); }
                else setShowAddModal(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? 0 : '0.35rem', padding: isMobile ? '7px 10px' : '7px 14px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            >
              <Plus size={14} />{!isMobile && 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          <BudgetChart transactions={allTransactions || []} showLast12Months={true} bpBalance={bpBalance} isBalanceHidden={isBalanceHidden} />
          <div style={{ padding: isMobile ? `1rem 0 calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` : '1.75rem 1.5rem' }}>

            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 1rem 1rem' }}>
                <button onClick={goToPrevMonth} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent' }}><ChevronLeft size={16} /></button>
                <button onClick={() => setSelectedMonth(new Date())} style={{ border: 'none', background: 'transparent', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', padding: 0 }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em', color: isCurrentMonth ? 'var(--foreground)' : 'var(--color-orange-400)' }}>
                    {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  {!isCurrentMonth && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-blue-600)', marginLeft: '8px' }}>→ today</span>}
                </button>
                <button onClick={goToNextMonth} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent' }}><ChevronRight size={16} /></button>
              </div>
            )}

            {!isMobile && (
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <StatCards cards={statCards} isBalanceHidden={isBalanceHidden} />

                  {(totalRecurringFixed > 0) && (
                    <FixedVsDiscretionaryCard
                      recurringFixed={totalRecurringFixed}
                      discretionary={discretionary}
                      totalExpenses={expensesTotal}
                      recurringMonthlyTotal={recurringMonthlyTotal}
                      entryTxns={entryTxns}
                      isBalanceHidden={isBalanceHidden}
                    />
                  )}

                  <BudgetChart transactions={[...txList, ...entryTxnsAsTx] as any[]} isBalanceHidden={isBalanceHidden} />
                  <BudgetInsights
                    transactions={[...txList, ...entryTxnsAsTx] as any[]}
                    allTransactions={allTransactions || []}
                    totalIncome={totalIncome}
                    totalExpenses={expensesTotal}
                    savings={investments}
                    isBalanceHidden={isBalanceHidden}
                  />
                </div>

                <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <RecurringMiniTable
                    recurringExpenses={recurringList}
                    entryTxns={entryTxns}
                    isBalanceHidden={isBalanceHidden}
                    onViewAll={() => setActiveTab('recurring')}
                    onAdd={() => { setEditingRecurring(null); setShowRecurringModal(true); }}
                  />
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h2 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', margin: 0 }}>Transactions</h2>
                      <span onClick={() => setActiveTab('transactions')} style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>View all →</span>
                    </div>
                    <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                      {combinedTxList.length === 0
                        ? <EmptyState onAdd={() => setShowAddModal(true)} message="No transactions yet this month" />
                        : combinedTxList.slice(0, 10).map((t: any) => (
                          <SwipeableRow
                            key={t.id}
                            transaction={t}
                            isRecurring={recurringIds.has(String(t.id))}
                            isRecurringEntry={!!t.isRecurringEntry}
                            isBalanceHidden={isBalanceHidden}
                            isMobile={isMobile}
                            onEdit={() => { if (!t.isRecurringEntry) { setEditingTransaction(t); setShowAddModal(true); } }}
                            onDelete={() => handleDeleteTransaction(t.id)}
                            onDuplicate={() => { if (!t.isRecurringEntry) handleDuplicate(t); }}
                            onToggleRecurring={() => { if (!t.isRecurringEntry) toggleRecurring(String(t.id)); }}
                          />
                        ))
                      }
                    </div>
                    <div onClick={() => setActiveTab('yearly')}
                      style={{ margin: '1rem', padding: '0.85rem 1rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))', color: 'var(--color-blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={14} /></div>
                        <div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Annual Report</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Year-over-year trends &amp; insights</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>→</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
                <StatCardsMobile cards={statCards} isBalanceHidden={isBalanceHidden} />
                {totalRecurringFixed > 0 && (
                  <FixedVsDiscretionaryCard
                    recurringFixed={totalRecurringFixed}
                    discretionary={discretionary}
                    totalExpenses={expensesTotal}
                    recurringMonthlyTotal={recurringMonthlyTotal}
                    entryTxns={entryTxns}
                    isBalanceHidden={isBalanceHidden}
                  />
                )}
                <BudgetChart transactions={[...txList, ...entryTxnsAsTx] as any[]} isBalanceHidden={isBalanceHidden} />
                <RecurringExpenseCard
                  recurringExpenses={recurringList}
                  isBalanceHidden={isBalanceHidden}
                  onViewAll={() => setActiveTab('recurring')}
                />
                <BalanceSplitCard cashBalance={cashBalance} bpBalance={bpBalance} isBalanceHidden={isBalanceHidden} />
                <MobileSavingsCard income={totalIncome} expenses={expensesTotal} savings={investments} isBalanceHidden={isBalanceHidden} />
                <div onClick={() => setActiveTab('yearly')}
                  style={{ padding: '0.9rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))', color: 'var(--color-blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={14} /></div>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Annual Report</p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Detailed yearly statistics</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>→</span>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Recent Transactions</h2>
                    <span onClick={() => setActiveTab('transactions')} style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500, WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}>View all →</span>
                  </div>
                  {combinedTxList.length === 0
                    ? <EmptyState onAdd={() => setShowAddModal(true)} message="No transactions this month" compact />
                    : combinedTxList.slice(0, 5).map((t: any) => (
                      <SwipeableRow
                        key={t.id}
                        transaction={t}
                        isRecurring={recurringIds.has(String(t.id))}
                        isRecurringEntry={!!t.isRecurringEntry}
                        isBalanceHidden={isBalanceHidden}
                        isMobile={isMobile}
                        onEdit={() => { if (!t.isRecurringEntry) { setEditingTransaction(t); setShowAddModal(true); } }}
                        onDelete={() => handleDeleteTransaction(t.id)}
                        onDuplicate={() => { if (!t.isRecurringEntry) handleDuplicate(t); }}
                        onToggleRecurring={() => { if (!t.isRecurringEntry) toggleRecurring(String(t.id)); }}
                      />
                    ))
                  }
                </div>
                <BudgetInsights
                  transactions={[...txList, ...entryTxnsAsTx] as any[]}
                  allTransactions={allTransactions || []}
                  totalIncome={totalIncome} totalExpenses={expensesTotal}
                  savings={investments} isBalanceHidden={isBalanceHidden}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TRANSACTIONS ───────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div style={{ padding: isMobile ? `1rem 0 calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` : '1.75rem 1.5rem' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', margin: isMobile ? '0 1rem' : 0 }}>
            <div style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                  All Transactions
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, marginLeft: 8, color: hasActiveFilter ? 'var(--color-orange-400)' : 'var(--muted-foreground)' }}>
                    {hasActiveFilter ? `${filteredTx.length} of ${combinedTxList.length}` : combinedTxList.length}
                  </span>
                  {entryTxns.length > 0 && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, marginLeft: 6, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)' }}>
                      +{entryTxns.length} recurring
                    </span>
                  )}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => setShowFilters(v => !v)}
                    style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s', background: showFilters || hasActiveFilter ? 'var(--foreground)' : 'var(--muted)', color: showFilters || hasActiveFilter ? 'var(--background)' : 'var(--muted-foreground)' }}>
                    <SlidersHorizontal size={13} />
                  </button>
                  <button onClick={() => setShowExportModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '5px 12px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', WebkitTapHighlightColor: 'transparent' }}>↓ Export</button>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search description, notes, category…"
                  style={{ width: '100%', padding: '7px 32px 7px 30px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.8rem', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}><X size={12} /></button>}
              </div>
              {showFilters && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['all', 'income', 'expense'] as const).map(t => (
                      <button key={t} onClick={() => setFilterType(t)}
                        style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: '1.5px solid', WebkitTapHighlightColor: 'transparent', borderColor: filterType === t ? 'var(--foreground)' : 'var(--border)', background: filterType === t ? 'var(--foreground)' : 'transparent', color: filterType === t ? 'var(--background)' : 'var(--muted-foreground)' }}>
                        {t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expense'}
                      </button>
                    ))}
                  </div>
                  {(categories || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => setFilterCatId(null)} style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', WebkitTapHighlightColor: 'transparent', borderColor: filterCatId === null ? 'var(--foreground)' : 'var(--border)', background: filterCatId === null ? 'var(--foreground)' : 'transparent', color: filterCatId === null ? 'var(--background)' : 'var(--muted-foreground)' }}>All</button>
                      {(categories || []).map(c => (
                        <button key={c.id} onClick={() => setFilterCatId(filterCatId === Number(c.id) ? null : Number(c.id))}
                          style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', WebkitTapHighlightColor: 'transparent', borderColor: filterCatId === Number(c.id) ? 'var(--foreground)' : 'var(--border)', background: filterCatId === Number(c.id) ? 'var(--foreground)' : 'transparent', color: filterCatId === Number(c.id) ? 'var(--background)' : 'var(--muted-foreground)' }}>{c.name}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" placeholder="Min €" value={filterAmtMin} onChange={e => setFilterAmtMin(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>–</span>
                    <input type="number" placeholder="Max €" value={filterAmtMax} onChange={e => setFilterAmtMax(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    {hasActiveFilter && <button onClick={clearFilters} style={{ padding: '4px 10px', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600, border: 'none', background: 'var(--destructive)', color: 'var(--background)', cursor: 'pointer', whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent' }}>Clear all</button>}
                  </div>
                </div>
              )}
            </div>

            {filteredTx.length === 0
              ? <EmptyState onAdd={() => setShowAddModal(true)} message={hasActiveFilter ? 'No transactions match your filters' : 'No transactions this month'} />
              : filteredTx.map((t: any) => (
                <SwipeableRow
                  key={t.id}
                  transaction={t}
                  isRecurring={recurringIds.has(String(t.id))}
                  isRecurringEntry={!!t.isRecurringEntry}
                  isBalanceHidden={isBalanceHidden}
                  isMobile={isMobile}
                  onEdit={() => { if (!t.isRecurringEntry) { setEditingTransaction(t); setShowAddModal(true); } }}
                  onDelete={() => handleDeleteTransaction(t.id)}
                  onDuplicate={() => { if (!t.isRecurringEntry) handleDuplicate(t); }}
                  onToggleRecurring={() => { if (!t.isRecurringEntry) toggleRecurring(String(t.id)); }}
                />
              ))
            }
          </div>
        </div>
      )}

      {/* ── ANNUAL ─────────────────────────────────────────────────────────── */}
      {activeTab === 'yearly' && (
        <div style={{ paddingBottom: isMobile ? `calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)))` : 0 }}>
          <YearlyStats
            allTransactions={allTransactions || []}
            allRecurringEntries={(recurringExpenses || []).map(r => ({ recurringExpense: r, entries: [] }))}
            hideNav
          />
        </div>
      )}

      {/* ── RECURRING ──────────────────────────────────────────────────────── */}
      {activeTab === 'recurring' && (
        <div style={{ paddingTop: isMobile ? '1rem' : 0, paddingBottom: isMobile ? `calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` : 0 }}>
          <div style={{ padding: isMobile ? 0 : '1.75rem 1.5rem' }}>
            <RecurringExpensesTable
              recurringExpenses={recurringList}
              isMobile={isMobile}
              isBalanceHidden={isBalanceHidden}
              onAdd={() => { setEditingRecurring(null); setShowRecurringModal(true); }}
              onEdit={(expense) => { setEditingRecurring(expense); setShowRecurringModal(true); }}
              onDelete={handleDeleteRecurringExpense}
              onDuplicate={handleDuplicateRecurringExpense}
            />
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showRecurringModal && (
        <RecurringExpenseModal
          categories={categories || []}
          onClose={() => { setShowRecurringModal(false); setEditingRecurring(null); }}
          onSave={handleAddRecurringExpense}
          initialData={editingRecurring || undefined}
        />
      )}
      {showExportModal     && <ExportModal transactions={allTransactions || []} onClose={() => setShowExportModal(false)} />}
      {showAddModal        && <AddTransactionModal categories={categories || []} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onSave={handleAddTransaction} initialData={editingTransaction || undefined} />}
      {showCategoriesModal && <ManageCategoriesModal categories={categories || []} onClose={() => setShowCategoriesModal(false)} onCreate={createCategory} onUpdate={updateCategory} onDelete={deleteCategory} />}

      <style>{`
        @keyframes dropIn { from { opacity:0; transform:scale(0.92) translateY(-6px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin    { to   { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ onAdd: () => void; message: string; compact?: boolean }> = ({ onAdd, message, compact }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: compact ? '1.5rem 1rem' : '3rem 1.5rem', gap: '0.75rem', textAlign: 'center' }}>
    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <TrendingUp size={20} color="var(--muted-foreground)" />
    </div>
    <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', margin: 0, fontWeight: 500 }}>{message}</p>
    <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <Plus size={12} /> Add transaction
    </button>
  </div>
);

// ── Fixed vs Discretionary card ───────────────────────────────────────────────
const FixedVsDiscretionaryCard: React.FC<{
  recurringFixed: number;
  discretionary: number;
  totalExpenses: number;
  recurringMonthlyTotal: number;
  entryTxns: RecurringEntryAsTx[];
  isBalanceHidden: boolean;
}> = ({ recurringFixed, discretionary, totalExpenses, entryTxns, isBalanceHidden }) => {
  const fixedPct  = totalExpenses > 0 ? Math.round((recurringFixed / totalExpenses) * 100) : 0;
  const topEntries = entryTxns.slice(0, 4);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.85rem' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={13} />
        </div>
        <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Fixed vs Discretionary</h3>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)' }}>
          {entryTxns.length} recurring
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '0.85rem' }}>
        <div style={{ background: 'color-mix(in srgb, var(--destructive) 7%, var(--background))', borderRadius: 10, padding: '0.7rem' }}>
          <p style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fixed costs</p>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--destructive)', margin: 0, letterSpacing: '-0.025em' }}>{isBalanceHidden ? '€••••••' : fmtEur(recurringFixed)}</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{fixedPct}% of expenses</p>
        </div>
        <div style={{ background: 'color-mix(in srgb, var(--color-blue-600) 7%, var(--background))', borderRadius: 10, padding: '0.7rem' }}>
          <p style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Discretionary</p>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-blue-600)', margin: 0, letterSpacing: '-0.025em' }}>{isBalanceHidden ? '€••••••' : fmtEur(discretionary)}</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{100 - fixedPct}% of expenses</p>
        </div>
      </div>

      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden', marginBottom: '0.75rem' }}>
        <div style={{ height: '100%', width: `${fixedPct}%`, background: 'var(--destructive)', borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>

      {topEntries.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={10} color="var(--color-orange-400)" />
            <span style={{ color: 'var(--muted-foreground)' }}>{e.description}</span>
          </div>
          <span style={{ fontWeight: 700, color: 'var(--destructive)' }}>{isBalanceHidden ? '€••' : fmtEur(e.amount)}</span>
        </div>
      ))}
      {entryTxns.length > 4 && (
        <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', margin: '4px 0 0' }}>+{entryTxns.length - 4} more recurring</p>
      )}
    </div>
  );
};

// ── Swipeable row ─────────────────────────────────────────────────────────────
const SwipeableRow: React.FC<{
  transaction: any;
  isRecurring: boolean;
  isRecurringEntry: boolean;
  isBalanceHidden: boolean;
  isMobile: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleRecurring: () => void;
}> = ({ transaction: t, isRecurring, isRecurringEntry, isBalanceHidden, isMobile, onEdit, onDelete, onDuplicate, onToggleRecurring }) => {
  const [offsetX, setOffsetX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX  = useRef<number | null>(null);
  const ACTIONS_W = isRecurringEntry ? 104 : 156;

  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setOffsetX(Math.max(dx, -ACTIONS_W - 10));
    else if (revealed) setOffsetX(Math.min(dx - ACTIONS_W, 0));
  };
  const handleTouchEnd = () => {
    if (offsetX < -(ACTIONS_W / 2)) { setOffsetX(-ACTIONS_W); setRevealed(true); }
    else { setOffsetX(0); setRevealed(false); }
    startX.current = null;
  };
  const close = () => { setOffsetX(0); setRevealed(false); };

  const isIncome = t.type === 'income';
  const amtColor = isIncome ? 'var(--success)' : 'var(--destructive)';
  const catName  = t.category?.name ?? '—';
  const dateStr  = new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
      {isMobile && (
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', width: ACTIONS_W }}>
          {!isRecurringEntry && (
            <button onClick={() => { close(); onToggleRecurring(); }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', cursor: 'pointer', background: isRecurring ? 'var(--color-orange-400)' : '#c97a1a', color: 'white', fontSize: '0.6rem', fontWeight: 700, WebkitTapHighlightColor: 'transparent' }}>
              <RefreshCw size={14} />
              <span style={{ lineHeight: 1.2, textAlign: 'center' }}>{isRecurring ? 'Fixed ✓' : 'Mark\nFixed'}</span>
            </button>
          )}
          {!isRecurringEntry && (
            <button onClick={() => { close(); onDuplicate(); }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', cursor: 'pointer', background: '#1d6fb5', color: 'white', fontSize: '0.6rem', fontWeight: 700, WebkitTapHighlightColor: 'transparent' }}>
              <Copy size={14} />Copy
            </button>
          )}
          <button onClick={() => { close(); onDelete(); }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', cursor: 'pointer', background: 'var(--destructive)', color: 'white', fontSize: '0.6rem', fontWeight: 700, WebkitTapHighlightColor: 'transparent' }}>
            <Trash2 size={14} />Delete
          </button>
        </div>
      )}
      <div
        onClick={() => { if (isMobile && revealed) { close(); return; } if (!isRecurringEntry) onEdit(); }}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', background: isRecurringEntry ? 'color-mix(in srgb, var(--color-orange-400) 3%, var(--card))' : 'var(--card)', transform: `translateX(${offsetX}px)`, transition: startX.current === null ? 'transform 0.2s ease' : 'none', cursor: isRecurringEntry ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
        onMouseEnter={e => { if (!isMobile && !isRecurringEntry) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; }}
        onMouseLeave={e => { if (!isMobile) (e.currentTarget as HTMLDivElement).style.background = isRecurringEntry ? 'color-mix(in srgb, var(--color-orange-400) 3%, var(--card))' : 'var(--card)'; }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: isRecurringEntry ? 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))' : isIncome ? 'color-mix(in srgb, var(--success) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRecurringEntry ? <RefreshCw size={14} color="var(--color-orange-400)" /> : isIncome ? <TrendingUp size={14} color="var(--success)" /> : <TrendingDown size={14} color="var(--destructive)" />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.description || catName}
            </span>
            {isRecurringEntry && (
              <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', fontSize: '0.6rem', fontWeight: 700 }}>
                <RefreshCw size={8} />Recurring
              </span>
            )}
            {!isRecurringEntry && isRecurring && (
              <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', fontSize: '0.6rem', fontWeight: 700 }}>
                <RefreshCw size={8} />Fixed
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>{catName} · {dateStr}</span>
          {t.notes && !t.notes.startsWith('recurring:') && (
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
              💬 {t.notes}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isRecurringEntry ? 'var(--color-orange-400)' : amtColor, letterSpacing: '-0.01em' }}>
            {isBalanceHidden ? '€••••••' : `${isIncome ? '+' : '-'}${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, style: 'currency', currency: 'EUR' }).replace('€', '€')}`}
          </span>
          {!isMobile && !isRecurringEntry && (
            <div style={{ display: 'flex', gap: 3 }}>
              {([
                { icon: <RefreshCw size={11} />, fn: onToggleRecurring, title: isRecurring ? 'Unmark fixed' : 'Mark fixed', active: isRecurring, danger: false },
                { icon: <Copy size={11} />,       fn: onDuplicate,       title: 'Duplicate',                                active: false,        danger: false },
                { icon: <Edit2 size={11} />,      fn: onEdit,            title: 'Edit',                                     active: false,        danger: false },
                { icon: <Trash2 size={11} />,     fn: onDelete,          title: 'Delete',                                   active: false,        danger: true  },
              ]).map(({ icon, fn, title, active, danger }) => (
                <button key={title} onClick={e => { e.stopPropagation(); fn(); }} title={title}
                  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s', background: active ? 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))' : 'var(--muted)', color: active ? 'var(--color-orange-400)' : 'var(--muted-foreground)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? 'color-mix(in srgb, var(--destructive) 12%, var(--background))' : 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = danger ? 'var(--destructive)' : 'var(--foreground)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))' : 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.color = active ? 'var(--color-orange-400)' : 'var(--muted-foreground)'; }}
                >{icon}</button>
              ))}
            </div>
          )}
          {!isMobile && isRecurringEntry && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Remove entry"
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, cursor: 'pointer', background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--destructive) 12%, var(--background))'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--destructive)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)'; }}
            ><Trash2 size={11} /></button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Delta badge ───────────────────────────────────────────────────────────────
const DeltaBadge: React.FC<{ delta: number; label: string; small?: boolean }> = ({ delta, label, small }) => {
  if (delta === 0) return null;
  const isExpense  = label === 'Expenses';
  const isPositive = delta > 0;
  const isGood  = isExpense ? !isPositive : isPositive;
  const color = isGood ? 'var(--success)' : 'var(--destructive)';
  const bg    = isGood ? 'color-mix(in srgb, var(--success) 10%, var(--background))' : 'color-mix(in srgb, var(--destructive) 10%, var(--background))';
  return (
    <span style={{ flexShrink: 0, fontSize: small ? '0.55rem' : '0.6rem', fontWeight: 700, padding: small ? '1px 4px' : '1px 5px', borderRadius: 999, background: bg, color, whiteSpace: 'nowrap' }}>
      {isPositive ? '+' : ''}{fmtCompact(delta)}
    </span>
  );
};

interface StatCard { label: string; value: number; delta?: number; icon: React.ReactNode; iconColor: string; iconBg: string; }

const StatCards: React.FC<{ cards: StatCard[]; isBalanceHidden: boolean }> = ({ cards, isBalanceHidden }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
    {cards.map(({ label, value, delta, icon, iconColor, iconBg }) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 7px 8px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--border)', flexShrink: 0, transition: 'background 0.15s', cursor: 'default' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--card)'; }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: (label === 'Cash' || label === 'Meal Vouchers') ? iconColor : 'var(--foreground)', whiteSpace: 'nowrap', letterSpacing: isBalanceHidden ? '0.02em' : '-0.01em' }}>
          {isBalanceHidden ? '€••••••' : fmtEur(value)}
        </span>
        {delta !== undefined && !isBalanceHidden && <DeltaBadge delta={delta} label={label} />}
      </div>
    ))}
  </div>
);

const StatCardsMobile: React.FC<{ cards: StatCard[]; isBalanceHidden: boolean }> = ({ cards, isBalanceHidden }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    {cards.map(({ label, value, delta, icon, iconColor, iconBg }, idx) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 8px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--border)', ...(idx === 4 ? { gridColumn: 'span 2', justifySelf: 'start' as const } : {}) }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: '0.63rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, letterSpacing: isBalanceHidden ? '0.02em' : '-0.01em', color: (label === 'Cash' || label === 'Meal Vouchers') ? iconColor : 'var(--foreground)', whiteSpace: 'nowrap' }}>
              {isBalanceHidden ? '€••••••' : fmtEur(value)}
            </p>
            {delta !== undefined && !isBalanceHidden && <DeltaBadge delta={delta} label={label} small />}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const BalanceSplitCard: React.FC<{ cashBalance: number; bpBalance: number; isBalanceHidden: boolean }> = ({ cashBalance, bpBalance, isBalanceHidden }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem' }}>
    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 0.75rem' }}>Balance Breakdown</h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      {[
        { label: 'Cash',          value: cashBalance, color: cashBalance >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)', emoji: '💵' },
        { label: 'Meal Vouchers', value: bpBalance,   color: bpBalance >= 0   ? 'var(--color-orange-400)' : 'var(--destructive)', emoji: '🎟️' },
      ].map(({ label, value, color, emoji }) => (
        <div key={label} style={{ background: 'var(--accent)', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>{emoji} {label}</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color, letterSpacing: isBalanceHidden ? '0.04em' : '-0.02em' }}>{isBalanceHidden ? '€••••••' : fmtEur(value)}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: value >= 0 ? 'var(--success)' : 'var(--destructive)' }}>{value >= 0 ? '▲ Positive' : '▼ Negative'}</span>
        </div>
      ))}
    </div>
  </div>
);

const FREQ_LABEL: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2w',
  monthly: 'Monthly', bimonthly: 'Every 2m', quarterly: 'Quarterly',
  semiannual: 'Every 6m', annual: 'Yearly', yearly: 'Yearly', custom: 'Custom',
};

const RecurringMiniTable: React.FC<{
  recurringExpenses: RecurringExpense[];
  entryTxns: RecurringEntryAsTx[];
  isBalanceHidden: boolean;
  onViewAll: () => void;
  onAdd: () => void;
}> = ({ recurringExpenses, entryTxns, isBalanceHidden, onViewAll, onAdd }) => {
  const active = recurringExpenses.filter(e => e.isActive);
  const monthlyTotal = entryTxns.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={11} /></div>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Recurring</h2>
          {active.length > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{active.length}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {active.length > 0 && <span onClick={onViewAll} style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>Manage →</span>}
          <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 7, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={10} />Add
          </button>
        </div>
      </div>

      {active.length === 0 ? (
        <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
            <RefreshCw size={16} color="var(--muted-foreground)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: '0 0 0.65rem', fontWeight: 500 }}>No recurring expenses yet</p>
          <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={11} />Add first
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', padding: '0.45rem 1.1rem', borderBottom: '1px solid var(--border)', background: 'var(--accent)' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expense</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Freq.</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>This month</span>
          </div>
          {entryTxns.slice(0, 6).map(e => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center', padding: '0.6rem 1.1rem', borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
              onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</p>
              <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 10%, var(--background))', color: 'var(--color-orange-400)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                {FREQ_LABEL[recurringExpenses.find(r => String(r.id) === String(e.recurringExpenseId))?.frequency ?? ''] ?? '—'}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--destructive)', whiteSpace: 'nowrap', textAlign: 'right', letterSpacing: '-0.01em' }}>
                {isBalanceHidden ? '€••••' : `-${fmtEur(e.amount)}`}
              </span>
            </div>
          ))}
          {entryTxns.length > 6 && (
            <div onClick={onViewAll} style={{ padding: '0.6rem 1.1rem', fontSize: '0.72rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500, textAlign: 'center', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              +{entryTxns.length - 6} more — view all →
            </div>
          )}
          <div style={{ padding: '0.65rem 1.1rem', background: 'var(--accent)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>Total this month</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--destructive)', letterSpacing: '-0.02em' }}>
              {isBalanceHidden ? '€••••••' : `-${fmtEur(monthlyTotal)}`}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

const MobileSavingsCard: React.FC<{ income: number; expenses: number; savings: number; isBalanceHidden: boolean }> = ({ income, expenses, savings, isBalanceHidden }) => {
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  const isPositive  = savingsRate >= 0;
  const spentPct    = income > 0 ? Math.min((expenses / income) * 100, 100) : 0;
  const fmt = (n: number) => isBalanceHidden ? '€••••••' : fmtEur(n);
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Monthly Summary</h3>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: isPositive ? 'color-mix(in srgb, var(--success) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))', color: isPositive ? 'var(--success)' : 'var(--destructive)' }}>
          {isBalanceHidden ? '••%' : `${isPositive ? '+' : ''}${savingsRate}% saved`}
        </span>
      </div>
      <div style={{ background: 'var(--muted)', borderRadius: '999px', height: 8, overflow: 'hidden', marginBottom: '0.75rem' }}>
        <div style={{ height: '100%', borderRadius: '999px', width: `${spentPct}%`, background: spentPct > 80 ? 'linear-gradient(90deg, var(--color-red-100), var(--destructive))' : 'linear-gradient(90deg, var(--color-green-100), var(--success))', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        {[{ label: 'Income', value: income, color: 'var(--success)' }, { label: 'Spent', value: expenses, color: 'var(--destructive)' }, { label: 'Invested', value: savings, color: 'var(--color-purple-600)' }].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color, margin: 0 }}>{fmt(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
