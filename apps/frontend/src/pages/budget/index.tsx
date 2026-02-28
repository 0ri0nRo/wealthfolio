// src/pages/Budget/index.tsx
import { useBalancePrivacy } from '@/hooks/use-balance-privacy';
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/lib/types/budget';
import { BarChart2, ChevronLeft, ChevronRight, Plus, Settings, Tag, TrendingDown, TrendingUp, UtensilsCrossed, Wallet } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AddTransactionModal } from "./components/add-transaction-modal";
import { BudgetChart } from "./components/budget-chart";
import { BudgetInsights } from "./components/budget-insights";
import { ExportModal } from "./components/ExportModal";
import { ManageCategoriesModal } from "./components/ManageCategoriesModal";
import { TransactionList } from "./components/transaction-list";
import { YearlyStats } from "./components/YearlyStats";

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

const isBuoniPasto = (t: BudgetTransaction) =>
  t.category?.name?.toLowerCase().includes('buoni pasto') ?? false;

const isInvestmentTx = (t: BudgetTransaction) => {
  if (!t.category) return false;
  const n = t.category.name.toLowerCase();
  return n.includes('invest') || n.includes('crypto') || n.includes('etf') || n.includes('stock');
};

type ActiveTab = 'overview' | 'transactions' | 'yearly';

export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showGearMenu, setShowGearMenu] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { isBalanceHidden, toggleBalanceVisibility } = useBalancePrivacy();

  const {
    transactions, allTransactions, categories,
    summary, loading, error,
    createTransaction, deleteTransaction, updateTransaction, refresh,
    createCategory, updateCategory, deleteCategory,
  } = useBudget(selectedMonth);

  useEffect(() => {
    if (!showGearMenu) return;
    const handler = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setShowGearMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGearMenu]);

  const txList    = transactions    || [];
  const allTxList = allTransactions || [];

  const bpIncomeMonth   = txList.filter(t => t.type === 'income'  && isBuoniPasto(t)).reduce((s, t) => s + t.amount, 0);
  const bpExpensesMonth = txList.filter(t => t.type === 'expense' && isBuoniPasto(t)).reduce((s, t) => s + t.amount, 0);
  const bpIncomeAll     = allTxList.filter(t => t.type === 'income'  && isBuoniPasto(t)).reduce((s, t) => s + t.amount, 0);
  const bpExpensesAll   = allTxList.filter(t => t.type === 'expense' && isBuoniPasto(t)).reduce((s, t) => s + t.amount, 0);
  const bpBalance       = bpIncomeAll - bpExpensesAll;
  const investments     = txList.filter(t => t.type === 'expense' && isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const totalIncome     = summary?.totalIncome ?? 0;
  const expensesTotal   = txList.filter(t => t.type === 'expense' && !isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const cashBalance     = (totalIncome - bpIncomeMonth) - (expensesTotal - bpExpensesMonth) - investments;

  const handleAddTransaction = async (transaction: Partial<BudgetTransaction>) => {
    try {
      if (editingTransaction) {
        await updateTransaction(Number(editingTransaction.id), transaction);
      } else {
        await createTransaction({
          categoryId: transaction.categoryId!, amount: transaction.amount!,
          type: transaction.type!, description: transaction.description!,
          date: transaction.date!, notes: transaction.notes,
        });
      }
      setShowAddModal(false);
      setEditingTransaction(null);
    } catch (err) {
      alert('Error saving transaction: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeleteTransaction = async (id: string | number) => {
    try { await deleteTransaction(id); } catch {}
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

  const fmtEur = (n: number) => `€${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const statCards = [
    { label: 'Income',        value: totalIncome,   icon: <TrendingUp size={14} />,   iconColor: 'var(--success)',              iconBg: 'color-mix(in srgb, var(--success) 12%, var(--background))'              },
    { label: 'Expenses',      value: expensesTotal, icon: <TrendingDown size={14} />, iconColor: 'var(--destructive)',          iconBg: 'color-mix(in srgb, var(--destructive) 12%, var(--background))'          },
    { label: 'Savings',       value: investments,   icon: <TrendingUp size={14} />,   iconColor: 'var(--color-purple-600)',     iconBg: 'color-mix(in srgb, var(--color-purple-600) 12%, var(--background))'     },
    {
      label: 'Cash', value: cashBalance,
      icon: <Wallet size={14} />,
      iconColor: cashBalance >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)',
      iconBg:    cashBalance >= 0 ? 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
    },
    {
      label: 'Meal Vouchers', value: bpBalance,
      icon: <UtensilsCrossed size={14} />,
      iconColor: bpBalance >= 0 ? 'var(--color-orange-400)' : 'var(--destructive)',
      iconBg:    bpBalance >= 0 ? 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
    },
  ];

  if (activeTab === 'yearly') {
    return (
      <>
        <YearlyStats allTransactions={allTransactions || []} onBack={() => setActiveTab('overview')} />
        {showAddModal && (
          <AddTransactionModal
            categories={categories || []}
            onClose={() => { setShowAddModal(false); setEditingTransaction(null); }}
            onSave={handleAddTransaction}
            initialData={editingTransaction || undefined}
          />
        )}
      </>
    );
  }

  const TABS: [ActiveTab, string][] = [
    ['overview',     'Overview'],
    ['transactions', isMobile ? 'Trans.' : 'Transactions'],
    ['yearly',       isMobile ? '📊' : '📊 Annual'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'color-mix(in srgb, var(--background) 92%, transparent)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '0 1rem' : '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', flexShrink: 0 }}>Budget</span>

          <div style={{ display: 'flex', gap: '2px', background: 'var(--muted)', borderRadius: '10px', padding: '3px', marginLeft: '6px' }}>
            {TABS.map(([key, label]) => (
              <span
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                  padding: isMobile ? '4px 8px' : '4px 12px', borderRadius: '8px', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: activeTab === key ? 'var(--card)' : 'transparent',
                  color:      activeTab === key ? 'var(--foreground)' : 'var(--muted-foreground)',
                  boxShadow:  activeTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Desktop month selector */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button onClick={goToPrevMonth} style={{ width: 28, height: 28, border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setSelectedMonth(new Date())}
                style={{ padding: '4px 10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent', background: isCurrentMonth ? 'var(--muted)' : 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))', color: isCurrentMonth ? 'var(--foreground)' : 'var(--color-orange-400)' }}
              >
                {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </button>
              <button onClick={goToNextMonth} style={{ width: 28, height: 28, border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* Gear + dropdown */}
          <div ref={gearRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowGearMenu(v => !v)}
              style={{ width: 34, height: 34, border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent', background: showGearMenu || isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', color: showGearMenu || isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)' }}
            >
              <Settings size={15} />
            </button>

            {showGearMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 50, animation: 'dropIn 0.16s cubic-bezier(.34,1.4,.64,1) forwards' }}>
                <div
                  onClick={toggleBalanceVisibility}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>
                    {isBalanceHidden ? '👁️' : '🙈'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Hide balances</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>
                      {isBalanceHidden ? 'Active across the app' : 'Tap to activate'}
                    </p>
                  </div>
                  <div style={{ width: 36, height: 20, borderRadius: '999px', flexShrink: 0, background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: 2, left: isBalanceHidden ? 'calc(100% - 18px)' : '2px', width: 16, height: 16, borderRadius: '50%', background: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left 0.2s' }} />
                  </div>
                </div>
                <div
                  onClick={() => { setShowCategoriesModal(true); setShowGearMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Tag size={14} color="var(--muted-foreground)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Categories</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>Manage &amp; edit</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? 0 : '0.35rem', padding: isMobile ? '7px 10px' : '7px 14px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            <Plus size={14} />
            {!isMobile && 'Add'}
          </button>
        </div>
      </div>

      {/* ── HERO CHART ────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <BudgetChart transactions={allTransactions || []} showLast12Months={true} bpBalance={bpBalance} isBalanceHidden={isBalanceHidden} />
        </div>
      )}

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? `0 0 calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` : '1.75rem 1.5rem' }}>

        {activeTab === 'overview' && (
          <>
            {/* Mobile month selector */}
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 1rem 10px' }}>
                <button onClick={goToPrevMonth} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent' }}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setSelectedMonth(new Date())} style={{ border: 'none', background: 'transparent', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', padding: 0 }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em', color: isCurrentMonth ? 'var(--foreground)' : 'var(--color-orange-400)' }}>
                    {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  {!isCurrentMonth && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-blue-600)', marginLeft: '8px' }}>→ today</span>}
                </button>
                <button onClick={goToNextMonth} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent' }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div style={{ padding: isMobile ? '0 1rem' : '0' }}>
              <StatCards cards={statCards} isMobile={isMobile} fmtEur={fmtEur} isBalanceHidden={isBalanceHidden} />
            </div>

            {/* Desktop */}
            {!isMobile && (
              <>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <BudgetChart transactions={transactions || []} isBalanceHidden={isBalanceHidden} />
                  </div>
                  <div style={{ width: 380, flexShrink: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Transactions</h2>
                      <span onClick={() => setActiveTab('transactions')} style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>View all →</span>
                    </div>
                    <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                      <TransactionList transactions={(transactions || []).slice(0, 8)} onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }} onDelete={handleDeleteTransaction} isBalanceHidden={isBalanceHidden} />
                    </div>
                  </div>
                </div>

                <div onClick={() => setActiveTab('yearly')} style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))', color: 'var(--color-blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart2 size={16} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Annual Report</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Year-over-year trends, streaks, category breakdowns and more</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>→</span>
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  <BudgetInsights transactions={transactions || []} allTransactions={allTransactions || []} totalIncome={totalIncome} totalExpenses={expensesTotal} savings={investments} isBalanceHidden={isBalanceHidden} />
                </div>
              </>
            )}

            {/* Mobile */}
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
                <BudgetChart transactions={transactions || []} isBalanceHidden={isBalanceHidden} />
                <BalanceSplitCard cashBalance={cashBalance} bpBalance={bpBalance} fmtEur={fmtEur} isBalanceHidden={isBalanceHidden} />
                <MobileSavingsCard income={totalIncome} expenses={expensesTotal} savings={investments} fmtEur={fmtEur} isBalanceHidden={isBalanceHidden} />

                <div onClick={() => setActiveTab('yearly')} style={{ padding: '0.9rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))', color: 'var(--color-blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart2 size={14} />
                    </div>
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
                  <TransactionList transactions={(transactions || []).slice(0, 5)} onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }} onDelete={handleDeleteTransaction} isBalanceHidden={isBalanceHidden} />
                </div>

                <BudgetInsights transactions={transactions || []} allTransactions={allTransactions || []} totalIncome={totalIncome} totalExpenses={expensesTotal} savings={investments} isBalanceHidden={isBalanceHidden} />
              </div>
            )}
          </>
        )}

        {activeTab === 'transactions' && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', margin: isMobile ? '1rem' : 0 }}>
            <div style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>All Transactions</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>{(transactions || []).length} total</span>
                <button onClick={() => setShowExportModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '5px 12px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', WebkitTapHighlightColor: 'transparent' }}>
                  ↓ Export
                </button>
              </div>
            </div>
            <TransactionList transactions={transactions || []} onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }} onDelete={handleDeleteTransaction} isBalanceHidden={isBalanceHidden} />
          </div>
        )}
      </div>

      {showExportModal && <ExportModal transactions={allTransactions || []} onClose={() => setShowExportModal(false)} />}
      {showAddModal && (
        <AddTransactionModal categories={categories || []} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onSave={handleAddTransaction} initialData={editingTransaction || undefined} />
      )}
      {showCategoriesModal && (
        <ManageCategoriesModal categories={categories || []} onClose={() => setShowCategoriesModal(false)} onCreate={createCategory} onUpdate={updateCategory} onDelete={deleteCategory} />
      )}

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: scale(0.92) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ── Stat Cards ────────────────────────────────────────────────────────────────
interface StatCard { label: string; value: number; icon: React.ReactNode; iconColor: string; iconBg: string; }

const StatCards: React.FC<{ cards: StatCard[]; isMobile: boolean; fmtEur: (n: number) => string; isBalanceHidden: boolean }> = ({ cards, isMobile, fmtEur, isBalanceHidden }) => (
  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: isMobile ? '1rem' : '1.75rem' }}>
    {cards.map(({ label, value, icon, iconColor, iconBg }, idx) => (
      <div
        key={label}
        style={{ background: 'var(--card)', padding: isMobile ? '0.85rem 0.9rem' : '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s', ...(isMobile && idx === 4 ? { gridColumn: 'span 2' } : {}) }}
        onMouseEnter={e => { if (!isMobile) e.currentTarget.style.background = 'var(--accent)'; }}
        onMouseLeave={e => { if (!isMobile) e.currentTarget.style.background = 'var(--card)'; }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
          <p style={{ fontSize: isMobile ? '0.95rem' : '1.2rem', fontWeight: 700, margin: 0, letterSpacing: isBalanceHidden ? '0.04em' : '-0.02em', color: (label === 'Cash' || label === 'Meal Vouchers') ? iconColor : 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isBalanceHidden ? '€••••••' : fmtEur(value)}
          </p>
        </div>
        <div style={{ width: isMobile ? 28 : 34, height: isMobile ? 28 : 34, borderRadius: '8px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '0.5rem' }}>
          {icon}
        </div>
      </div>
    ))}
  </div>
);

// ── Balance split card (mobile) ───────────────────────────────────────────────
const BalanceSplitCard: React.FC<{ cashBalance: number; bpBalance: number; fmtEur: (n: number) => string; isBalanceHidden: boolean }> = ({ cashBalance, bpBalance, fmtEur, isBalanceHidden }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem' }}>
    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 0.75rem' }}>Balance Breakdown</h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      {[
        { label: 'Cash',          value: cashBalance, color: cashBalance >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)', emoji: '💵' },
        { label: 'Meal Vouchers', value: bpBalance,   color: bpBalance   >= 0 ? 'var(--color-orange-400)' : 'var(--destructive)', emoji: '🎟️' },
      ].map(({ label, value, color, emoji }) => (
        <div key={label} style={{ background: 'var(--accent)', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>{emoji} {label}</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color, letterSpacing: isBalanceHidden ? '0.04em' : '-0.02em' }}>
            {isBalanceHidden ? '€••••••' : fmtEur(value)}
          </span>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: value >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
            {value >= 0 ? '▲ Positive' : '▼ Negative'}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ── Mobile savings card ───────────────────────────────────────────────────────
const MobileSavingsCard: React.FC<{ income: number; expenses: number; savings: number; fmtEur: (n: number) => string; isBalanceHidden: boolean }> = ({ income, expenses, savings, fmtEur, isBalanceHidden }) => {
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
        {[
          { label: 'Income',   value: income,   color: 'var(--success)'          },
          { label: 'Spent',    value: expenses, color: 'var(--destructive)'      },
          { label: 'Invested', value: savings,  color: 'var(--color-purple-600)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color, margin: 0 }}>{fmt(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
