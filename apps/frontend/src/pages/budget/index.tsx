// src/pages/Budget/index.tsx
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/lib/types/budget';
import { Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AddTransactionModal } from "./components/add-transaction-modal";
import { BudgetChart } from "./components/budget-chart";
import { BudgetInsights } from "./components/budget-insights";
import { MonthSelector } from "./components/month-selector";
import { TransactionList } from "./components/transaction-list";

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

export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
  const isMobile = useIsMobile();

  const {
    transactions, allTransactions, categories,
    summary, loading, error,
    createTransaction, deleteTransaction, updateTransaction, refresh,
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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ width:28, height:28, border:'2.5px solid #111827', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ textAlign:'center', padding:'0 1.5rem' }}>
        <p style={{ color:'#dc2626', fontWeight:600, marginBottom:8 }}>Error loading budget data</p>
        <p style={{ color:'#6b7280', marginBottom:24 }}>{error}</p>
        <button onClick={refresh} style={{ padding:'8px 20px', background:'#111827', color:'#fff', border:'none', borderRadius:'10px', fontWeight:600, cursor:'pointer' }}>Retry</button>
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
    { label: 'Income',   value: summary?.totalIncome ?? 0, icon: <TrendingUp size={14} />,  color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Expenses', value: expensesWithoutInvestments, icon: <TrendingDown size={14} />, color: '#dc2626', bg: '#fef2f2' },
    { label: 'Savings',  value: investments,                icon: <TrendingUp size={14} />,  color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Balance',  value: actualBalance,              icon: <Wallet size={14} />,
      color: actualBalance >= 0 ? '#2563eb' : '#dc2626',
      bg:    actualBalance >= 0 ? '#eff6ff' : '#fef2f2' },
  ];

  const TABS: [string, string][] = [['overview', 'Overview'], ['transactions', 'Transactions']];

  return (
    <div style={{ minHeight:'100vh', background:'#ffffff', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:'rgba(255,255,255,0.92)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
        {/* Main nav row */}
        <div style={{
          maxWidth:1280, margin:'0 auto',
          padding: isMobile ? '0 1rem' : '0 1.5rem',
          height:52, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem',
        }}>
          {/* Title + tabs */}
          <div style={{ display:'flex', alignItems:'center', gap: isMobile ? '0.6rem' : '1rem', minWidth:0 }}>
            <span style={{ fontSize:'1rem', fontWeight:800, color:'#111827', letterSpacing:'-0.02em', flexShrink:0 }}>
              Budget
            </span>
            <div style={{ display:'flex', gap:'2px', background:'#f3f4f6', borderRadius:'10px', padding:'3px' }}>
              {TABS.map(([key, label]) => (
                <span
                  key={key}
                  onClick={() => setActiveTab(key as 'overview' | 'transactions')}
                  style={{
                    fontSize:'0.75rem', fontWeight:600, whiteSpace:'nowrap',
                    padding: isMobile ? '4px 8px' : '4px 12px',
                    borderRadius:'8px', cursor:'pointer',
                    background: activeTab === key ? '#ffffff' : 'transparent',
                    color:      activeTab === key ? '#111827' : '#9ca3af',
                    boxShadow:  activeTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition:'all 0.15s',
                  }}
                >
                  {/* Shorten on mobile */}
                  {isMobile && key === 'transactions' ? 'Trans.' : label}
                </span>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0 }}>
            {/* Month selector only on desktop in nav */}
            {!isMobile && (
              <MonthSelector selectedMonth={selectedMonth} onChange={(d: Date) => setSelectedMonth(d)} />
            )}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display:'inline-flex', alignItems:'center', gap: isMobile ? 0 : '0.35rem',
                padding: isMobile ? '7px 10px' : '7px 14px',
                background:'#111827', color:'#fff', border:'none',
                borderRadius:'10px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer',
              }}
            >
              <Plus size={14} />
              {!isMobile && 'Add'}
            </button>
          </div>
        </div>

        {/* Mobile: month selector in second row */}
        {isMobile && (
          <div style={{ padding:'0 1rem 0.6rem', display:'flex', justifyContent:'center' }}>
            <MonthSelector selectedMonth={selectedMonth} onChange={(d: Date) => setSelectedMonth(d)} />
          </div>
        )}
      </div>

      {/* ── HERO CHART ───────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
          <BudgetChart transactions={allTransactions || []} showLast12Months={true} />
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth:1280, margin:'0 auto', padding: isMobile ? '1rem' : '1.75rem 1.5rem' }}>

        {activeTab === 'overview' && (
          <>
            {/* Stat cards: 2×2 mobile / 4×1 desktop */}
            <div style={{
              display:'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap:'1px',
              background:'rgba(0,0,0,0.06)',
              borderRadius:'14px', overflow:'hidden',
              marginBottom: isMobile ? '1rem' : '1.75rem',
              boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
            }}>
              {statCards.map(({ label, value, icon, color, bg }) => (
                <div
                  key={label}
                  style={{
                    background:'#ffffff',
                    padding: isMobile ? '0.85rem 0.9rem' : '1.1rem 1.25rem',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isMobile) e.currentTarget.style.background = '#fafafa'; }}
                  onMouseLeave={e => { if (!isMobile) e.currentTarget.style.background = '#ffffff'; }}
                >
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:'0.68rem', fontWeight:500, color:'#9ca3af', margin:'0 0 3px' }}>{label}</p>
                    <p style={{
                      fontSize: isMobile ? '0.95rem' : '1.2rem',
                      fontWeight:700, margin:0, letterSpacing:'-0.02em',
                      color: label === 'Balance' ? color : '#111827',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {fmtEur(value)}
                    </p>
                  </div>
                  <div style={{
                    width: isMobile ? 28 : 34, height: isMobile ? 28 : 34,
                    borderRadius:'8px', background:bg, color,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexShrink:0, marginLeft:'0.5rem',
                  }}>
                    {icon}
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP: two-column */}
            {!isMobile && (
              <>
                <div style={{ display:'flex', gap:'1.25rem', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <BudgetChart transactions={transactions || []} />
                  </div>
                  <div style={{
                    width:380, flexShrink:0, background:'#ffffff',
                    border:'1px solid rgba(0,0,0,0.06)', borderRadius:'16px',
                    overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{
                      padding:'0.85rem 1.1rem', borderBottom:'1px solid rgba(0,0,0,0.05)',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                    }}>
                      <h2 style={{ fontSize:'0.875rem', fontWeight:700, color:'#111827', margin:0 }}>Transactions</h2>
                      <span onClick={() => setActiveTab('transactions')}
                        style={{ fontSize:'0.75rem', color:'#6b7280', cursor:'pointer', fontWeight:500 }}>
                        View all →
                      </span>
                    </div>
                    <div style={{ maxHeight:600, overflowY:'auto' }}>
                      <TransactionList
                        transactions={(transactions || []).slice(0, 8)}
                        onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }}
                        onDelete={handleDeleteTransaction}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop:'1.25rem' }}>
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
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {/* Category chart */}
                <BudgetChart transactions={transactions || []} />

                {/* Savings Rate mini card */}
                <MobileSavingsCard
                  income={summary?.totalIncome ?? 0}
                  expenses={expensesWithoutInvestments}
                  savings={investments}
                  fmtEur={fmtEur}
                />

                {/* Recent transactions */}
                <div style={{
                  background:'#ffffff', border:'1px solid rgba(0,0,0,0.06)',
                  borderRadius:'16px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    padding:'0.8rem 1rem', borderBottom:'1px solid rgba(0,0,0,0.05)',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <h2 style={{ fontSize:'0.85rem', fontWeight:700, color:'#111827', margin:0 }}>
                      Recent Transactions
                    </h2>
                    <span
                      onClick={() => setActiveTab('transactions')}
                      style={{ fontSize:'0.72rem', color:'#6b7280', cursor:'pointer', fontWeight:500 }}
                    >
                      View all →
                    </span>
                  </div>
                  <TransactionList
                    transactions={(transactions || []).slice(0, 5)}
                    onEdit={t => { setEditingTransaction(t); setShowAddModal(true); }}
                    onDelete={handleDeleteTransaction}
                  />
                </div>

                {/* Insights charts — all 5, mobile-adapted via their own responsive logic */}
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
            background:'#ffffff', border:'1px solid rgba(0,0,0,0.06)',
            borderRadius:'16px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
              borderBottom:'1px solid rgba(0,0,0,0.05)',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <h2 style={{ fontSize:'0.9rem', fontWeight:700, color:'#111827', margin:0 }}>
                All Transactions
              </h2>
              <span style={{ fontSize:'0.72rem', color:'#9ca3af', fontWeight:500 }}>
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

      {showAddModal && (
        <AddTransactionModal
          categories={categories || []}
          onClose={() => { setShowAddModal(false); setEditingTransaction(null); }}
          onSave={handleAddTransaction}
          initialData={editingTransaction || undefined}
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
      background:'#ffffff', border:'1px solid rgba(0,0,0,0.06)',
      borderRadius:'16px', padding:'1rem', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
        <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'#111827', margin:0 }}>Monthly Summary</h3>
        <span style={{
          fontSize:'0.75rem', fontWeight:700, padding:'3px 9px', borderRadius:'999px',
          background: isPositive ? '#f0fdf4' : '#fef2f2',
          color:      isPositive ? '#16a34a' : '#dc2626',
        }}>
          {isPositive ? '+' : ''}{savingsRate}% saved
        </span>
      </div>

      {/* Progress bar: expenses vs income */}
      <div style={{ background:'#f3f4f6', borderRadius:'999px', height:8, overflow:'hidden', marginBottom:'0.75rem' }}>
        <div style={{
          height:'100%', borderRadius:'999px', width:`${spentPct}%`,
          background: spentPct > 80
            ? 'linear-gradient(90deg, #fca5a5, #ef4444)'
            : 'linear-gradient(90deg, #86efac, #22c55e)',
          transition:'width 0.5s ease',
        }} />
      </div>

      {/* Row of figures */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem' }}>
        {[
          { label:'Income',  value: fmtEur(income),  color:'#16a34a' },
          { label:'Spent',   value: fmtEur(expenses), color:'#ef4444' },
          { label:'Invested',value: fmtEur(savings),  color:'#7c3aed' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign:'center' }}>
            <p style={{ fontSize:'0.65rem', color:'#9ca3af', fontWeight:500, margin:'0 0 2px' }}>{label}</p>
            <p style={{ fontSize:'0.78rem', fontWeight:700, color, margin:0 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
