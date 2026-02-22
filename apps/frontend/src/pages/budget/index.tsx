// src/pages/Budget/index.tsx
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/lib/types/budget';
import { BarChart2, Plus, Tag, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AddTransactionModal } from "./components/add-transaction-modal";
import { BudgetChart } from "./components/budget-chart";
import { BudgetInsights } from "./components/budget-insights";
import { ManageCategoriesModal } from "./components/ManageCategoriesModal";
import { MonthSelector } from "./components/month-selector";
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

type ActiveTab = 'overview' | 'transactions' | 'yearly';

export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const isMobile = useIsMobile();

  const {
    transactions, allTransactions, categories,
    summary, loading, error,
    createTransaction, deleteTransaction, updateTransaction, refresh,
    createCategory, updateCategory, deleteCategory,
  } = useBudget(selectedMonth);

  const actualBalance = (summary?.totalIncome ?? 0) - (summary?.totalExpenses ?? 0);

  const handleAddTransaction = async (transaction: Partial<BudgetTransaction>) => {
    try {
      if (editingTransaction) {
        await updateTransaction(Number(editingTransaction.id), transaction);
      } else {
        await createTransaction({
          categoryId: transaction.categoryId!,
          amount: transaction.amount!,
          type: transaction.type!,
          description: transaction.description!,
          date: transaction.date!,
          notes: transaction.notes,
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

  const expensesWithoutInvestments = (transactions || [])
    .filter(t => t.type === 'expense' && t.category?.name !== 'Investments')
    .reduce((s, t) => s + t.amount, 0);

  const investments = (transactions || [])
    .filter(t => t.type === 'expense' && t.category?.name === 'Investments')
    .reduce((s, t) => s + t.amount, 0);

  const fmtEur = (n: number) => `€${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const statCards = [
    { label: 'Income',   value: summary?.totalIncome ?? 0, icon: <TrendingUp size={14} />,  iconColor: '#16a34a', iconBg: 'color-mix(in srgb, #16a34a 12%, var(--background))' },
    { label: 'Expenses', value: expensesWithoutInvestments, icon: <TrendingDown size={14} />, iconColor: '#dc2626', iconBg: 'color-mix(in srgb, #dc2626 12%, var(--background))' },
    { label: 'Savings',  value: investments,                icon: <TrendingUp size={14} />,  iconColor: '#7c3aed', iconBg: 'color-mix(in srgb, #7c3aed 12%, var(--background))' },
    { label: 'Balance',  value: actualBalance,              icon: <Wallet size={14} />,
      iconColor: actualBalance >= 0 ? '#2563eb' : '#dc2626',
      iconBg: actualBalance >= 0
        ? 'color-mix(in srgb, #2563eb 12%, var(--background))'
        : 'color-mix(in srgb, #dc2626 12%, var(--background))',
    },
  ];

  // ── Se la tab è "yearly" renderizza la pagina annuale direttamente ────────
  if (activeTab === 'yearly') {
    return (
      <>
        <YearlyStats
          allTransactions={allTransactions || []}
          onBack={() => setActiveTab('overview')}
        />
        {/* Modals rimangono accessibili anche in yearly view */}
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
    ['overview', 'Overview'],
    ['transactions', isMobile ? 'Trans.' : 'Transactions'],
    ['yearly', isMobile ? 'Annual' : 'Annual Report'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'color-mix(in srgb, var(--background) 92%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: isMobile ? '0 1rem' : '0 1.5rem',
          height: 52,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.6rem' : '1rem', minWidth: 0 }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', flexShrink: 0 }}>
              Budget
            </span>
            <div style={{ display: 'flex', gap: '2px', background: 'var(--muted)', borderRadius: '10px', padding: '3px' }}>
              {TABS.map(([key, label]) => (
                <span
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                    padding: isMobile ? '4px 8px' : '4px 12px',
                    borderRadius: '8px', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: activeTab === key ? 'var(--card)' : 'transparent',
                    color: activeTab === key ? 'var(--foreground)' : 'var(--muted-foreground)',
                    boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {key === 'yearly' && <BarChart2 size={11} />}
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {!isMobile && (
              <MonthSelector selectedMonth={selectedMonth} onChange={(d: Date) => setSelectedMonth(d)} />
            )}

            <button
              onClick={() => setShowCategoriesModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: isMobile ? 0 : '0.35rem',
                padding: isMobile ? '7px 10px' : '7px 14px',
                background: 'var(--muted)', color: 'var(--foreground)', border: 'none',
                borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Tag size={14} />
              {!isMobile && 'Categories'}
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: isMobile ? 0 : '0.35rem',
                padding: isMobile ? '7px 10px' : '7px 14px',
                background: 'var(--foreground)', color: 'var(--background)', border: 'none',
                borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              {!isMobile && 'Add'}
            </button>
          </div>
        </div>

        {isMobile && (
          <div style={{ padding: '0 1rem 0.6rem', display: 'flex', justifyContent: 'center' }}>
            <MonthSelector selectedMonth={selectedMonth} onChange={(d: Date) => setSelectedMonth(d)} />
          </div>
        )}
      </div>

      {/* ── HERO CHART ──────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <BudgetChart transactions={allTransactions || []} showLast12Months={true} />
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? `1rem 1rem calc(var(--mobile-nav-ui-height) + max(var(--mobile-nav-gap), env(safe-area-inset-bottom)) + 1rem)` : '1.75rem 1.5rem' }}>

        {activeTab === 'overview' && (
          <>
            {/* Stat cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: '1px',
              background: 'var(--border)',
              borderRadius: '14px', overflow: 'hidden',
              marginBottom: isMobile ? '1rem' : '1.75rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              {statCards.map(({ label, value, icon, iconColor, iconBg }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--card)',
                    padding: isMobile ? '0.85rem 0.9rem' : '1.1rem 1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isMobile) e.currentTarget.style.background = 'var(--accent)'; }}
                  onMouseLeave={e => { if (!isMobile) e.currentTarget.style.background = 'var(--card)'; }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                    <p style={{
                      fontSize: isMobile ? '0.95rem' : '1.2rem',
                      fontWeight: 700, margin: 0, letterSpacing: '-0.02em',
                      color: label === 'Balance' ? iconColor : 'var(--foreground)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {fmtEur(value)}
                    </p>
                  </div>
                  <div style={{
                    width: isMobile ? 28 : 34, height: isMobile ? 28 : 34,
                    borderRadius: '8px', background: iconBg, color: iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginLeft: '0.5rem',
                  }}>
                    {icon}
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP: two-column */}
            {!isMobile && (
              <>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <BudgetChart transactions={transactions || []} />
                  </div>
                  <div style={{
                    width: 380, flexShrink: 0, background: 'var(--card)',
                    border: '1px solid var(--border)', borderRadius: '16px',
                    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{
                      padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Transactions</h2>
                      <span onClick={() => setActiveTab('transactions')}
                        style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>
                        View all →
                      </span>
                    </div>
                    <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                      <TransactionList
                        transactions={(transactions || []).slice(0, 8)}
                        onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }}
                        onDelete={handleDeleteTransaction}
                      />
                    </div>
                  </div>
                </div>

                {/* Annual Report shortcut banner */}
                <div
                  onClick={() => setActiveTab('yearly')}
                  style={{
                    marginTop: '1.25rem',
                    padding: '1rem 1.25rem',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'color-mix(in srgb, #2563eb 12%, var(--background))',
                      color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BarChart2 size={16} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Annual Report</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                        Year-over-year trends, streaks, category breakdowns and more
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>→</span>
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  <BudgetInsights
                    transactions={transactions || []}
                    allTransactions={allTransactions || []}
                    totalIncome={summary?.totalIncome ?? 0}
                    totalExpenses={expensesWithoutInvestments}
                    savings={investments}
                  />
                </div>
              </>
            )}

            {/* MOBILE: single column */}
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <BudgetChart transactions={transactions || []} />
                <MobileSavingsCard
                  income={summary?.totalIncome ?? 0}
                  expenses={expensesWithoutInvestments}
                  savings={investments}
                  fmtEur={fmtEur}
                />

                {/* Annual report shortcut — mobile */}
                <div
                  onClick={() => setActiveTab('yearly')}
                  style={{
                    padding: '0.9rem 1rem',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: 'color-mix(in srgb, #2563eb 12%, var(--background))',
                      color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BarChart2 size={14} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Annual Report</p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Statistiche annuali dettagliate</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>→</span>
                </div>

                <div style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                      Recent Transactions
                    </h2>
                    <span onClick={() => setActiveTab('transactions')} style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>
                      View all →
                    </span>
                  </div>
                  <TransactionList
                    transactions={(transactions || []).slice(0, 5)}
                    onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }}
                    onDelete={handleDeleteTransaction}
                  />
                </div>
                <BudgetInsights
                  transactions={transactions || []}
                  allTransactions={allTransactions || []}
                  totalIncome={summary?.totalIncome ?? 0}
                  totalExpenses={expensesWithoutInvestments}
                  savings={investments}
                />
              </div>
            )}
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                All Transactions
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                {(transactions || []).length} total
              </span>
            </div>
            <TransactionList
              transactions={transactions || []}
              onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }}
              onDelete={handleDeleteTransaction}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddTransactionModal
          categories={categories || []}
          onClose={() => { setShowAddModal(false); setEditingTransaction(null); }}
          onSave={handleAddTransaction}
          initialData={editingTransaction || undefined}
        />
      )}

      {showCategoriesModal && (
        <ManageCategoriesModal
          categories={categories || []}
          onClose={() => setShowCategoriesModal(false)}
          onCreate={createCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
        />
      )}
    </div>
  );
};

// ── Mobile-only savings summary card ─────────────────────────────────────────
const MobileSavingsCard: React.FC<{
  income: number; expenses: number; savings: number;
  fmtEur: (n: number) => string;
}> = ({ income, expenses, savings, fmtEur }) => {
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  const isPositive = savingsRate >= 0;
  const spentPct = income > 0 ? Math.min((expenses / income) * 100, 100) : 0;

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Monthly Summary</h3>
        <span style={{
          fontSize: '0.75rem', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
          background: isPositive
            ? 'color-mix(in srgb, #16a34a 12%, var(--background))'
            : 'color-mix(in srgb, #dc2626 12%, var(--background))',
          color: isPositive ? '#16a34a' : '#dc2626',
        }}>
          {isPositive ? '+' : ''}{savingsRate}% saved
        </span>
      </div>

      <div style={{ background: 'var(--muted)', borderRadius: '999px', height: 8, overflow: 'hidden', marginBottom: '0.75rem' }}>
        <div style={{
          height: '100%', borderRadius: '999px', width: `${spentPct}%`,
          background: spentPct > 80
            ? 'linear-gradient(90deg, #fca5a5, #ef4444)'
            : 'linear-gradient(90deg, #86efac, #22c55e)',
          transition: 'width 0.5s ease',
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        {[
          { label: 'Income',   value: fmtEur(income),   color: '#16a34a' },
          { label: 'Spent',    value: fmtEur(expenses),  color: '#ef4444' },
          { label: 'Invested', value: fmtEur(savings),   color: '#7c3aed' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
