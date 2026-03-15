import { BudgetTransaction } from '@/lib/types/budget';
import React, { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface BudgetChartProps {
  transactions: BudgetTransaction[];
  showLast12Months?: boolean;
  bpBalance?: number;
  isBalanceHidden?: boolean;
}

const isInvestment = (t: BudgetTransaction) => {
  if (!t.category) return false;
  const n = t.category.name.toLowerCase();
  return n.includes('invest') || n.includes('crypto') || n.includes('etf') || n.includes('stock');
};

const COLORS = [
  '#f9ae77', '#87d3c3', '#c4b9e0', '#bec97e',
  '#92bfdb', '#f4a4c2', '#f89a8a', '#f6e2a0',
];

type TimePeriod = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
const TIME_PERIODS: TimePeriod[] = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

function getDateRangeForPeriod(period: TimePeriod): Date {
  const now = new Date();
  switch (period) {
    case '1W':  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    case '1M':  return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3M':  return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '6M':  return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case 'YTD': return new Date(now.getFullYear(), 0, 1);
    case '1Y':  return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'ALL': return new Date(2000, 0, 1);
  }
}

const PERIOD_LABEL: Record<TimePeriod, string> = {
  '1W': 'past week', '1M': 'past 30 days', '3M': 'past 3 months',
  '6M': 'past 6 months', 'YTD': 'year to date', '1Y': 'past year', 'ALL': 'all time',
};

const PillTooltip = ({
  active, payload, label, isBalanceHidden,
}: { active?: boolean; payload?: readonly any[]; label?: string | number; isBalanceHidden: boolean }) => {
  if (!active || !payload?.length) return null;
  const income   = payload.find((p: any) => p.dataKey === 'income')?.value  ?? 0;
  const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value ?? 0;
  const fmt = (n: number) =>
    isBalanceHidden ? '€••••' : `€${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '7px 14px', borderRadius: '999px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      fontSize: '12px', whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>
      <span style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#30a46c', display: 'inline-block' }} />
        <span style={{ color: '#30a46c', fontWeight: 700 }}>{fmt(income)}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e5484d', display: 'inline-block' }} />
        <span style={{ color: '#e5484d', fontWeight: 700 }}>{fmt(expenses)}</span>
      </span>
    </div>
  );
};

const CategoryTooltip = ({ active, payload, isBalanceHidden }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass" style={{ borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
      <p style={{ color: 'var(--foreground)', fontWeight: 600, margin: '0 0 2px' }}>{payload[0]?.payload?.name}</p>
      <p style={{ color: 'var(--muted-foreground)', margin: 0 }}>
        {isBalanceHidden ? '€••••••' : `€${Number(payload[0]?.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
      </p>
    </div>
  );
};

export const BudgetChart: React.FC<BudgetChartProps> = ({
  transactions = [],
  showLast12Months = false,
  bpBalance,
  isBalanceHidden = false,
}) => {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1M');

  const fmtOrHide = (n: number) =>
    isBalanceHidden ? '€••••••' : `€${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const heroChartData = useMemo(() => {
    if (!showLast12Months) return [];
    const now = new Date();
    let fromDate = getDateRangeForPeriod(selectedPeriod);
    if (selectedPeriod === 'ALL' && transactions.length > 0) {
      const earliest = transactions.reduce((min, t) => { const d = parseDate(t.date); return d < min ? d : min; }, new Date());
      fromDate = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    }
    const isShortPeriod = selectedPeriod === '1W' || selectedPeriod === '1M';
    type DataPoint = { label: string; income: number; expenses: number };
    const points = new Map<string, DataPoint>();

    if (isShortPeriod) {
      const days = selectedPeriod === '1W' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        points.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, {
          label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          income: 0, expenses: 0,
        });
      }
    } else {
      let cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      while (cursor <= now) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        const spanYears = now.getFullYear() - fromDate.getFullYear();
        points.set(key, {
          label: spanYears > 2
            ? (cursor.getMonth() === 0 ? cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : '')
            : cursor.toLocaleDateString('en-GB', { month: 'short', year: cursor.getFullYear() !== now.getFullYear() ? '2-digit' : undefined }),
          income: 0, expenses: 0,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }

    transactions.filter(t => parseDate(t.date) >= fromDate).forEach(t => {
      const d = parseDate(t.date);
      const key = isShortPeriod
        ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        : `${d.getFullYear()}-${d.getMonth()}`;
      const point = points.get(key);
      if (!point) return;
      if (t.type === 'income') point.income += t.amount;
      if (t.type === 'expense' && !isInvestment(t)) point.expenses += t.amount;
    });
    return Array.from(points.values());
  }, [transactions, showLast12Months, selectedPeriod]);

  const heroStats = useMemo(() => {
    const totalIncome   = heroChartData.reduce((s, d) => s + d.income, 0);
    const totalExpenses = heroChartData.reduce((s, d) => s + d.expenses, 0);
    const balance       = totalIncome - totalExpenses;
    const balancePct    = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    return { totalIncome, totalExpenses, balance, balancePct };
  }, [heroChartData]);

  // ── HERO CHART — full bleed, matches Investments aesthetic ────────────────
  if (showLast12Months) {
    const isPositive = heroStats.balance >= 0;
    const hasBp      = bpBalance !== undefined;
    const bpPositive = (bpBalance ?? 0) >= 0;
    const isMobileHero = typeof window !== 'undefined' && window.innerWidth < 768;
    const chartHeight  = isMobileHero ? 200 : 320;
    const hPad         = isMobileHero ? '1rem' : '1.5rem';

    return (
      <div style={{ background: 'var(--background)', position: 'relative' }}>
        {/* Amount + stats */}
        <div style={{ padding: `1.25rem ${hPad} 0` }}>
          <p style={{ fontSize: isMobileHero ? '1.75rem' : '2.25rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 0.4rem' }}>
            {isBalanceHidden ? '€••••••' : `€${heroStats.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--destructive)' }}>
              {isBalanceHidden ? `${isPositive ? '+' : ''}€••••••` : `${isPositive ? '+' : ''}€${heroStats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--destructive)' }}>
              {isBalanceHidden ? '••••%' : `${isPositive ? '+' : ''}${heroStats.balancePct.toFixed(2)}%`}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
              {PERIOD_LABEL[selectedPeriod]}
            </span>
            {hasBp && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                background: bpPositive
                  ? 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))'
                  : 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
                color: bpPositive ? 'var(--color-orange-400)' : 'var(--destructive)',
                border: `1px solid ${bpPositive ? 'color-mix(in srgb, var(--color-orange-400) 25%, transparent)' : 'color-mix(in srgb, var(--destructive) 25%, transparent)'}`,
              }}>
                🎟️ {isBalanceHidden ? '€••••••' : `${bpPositive ? '' : '-'}€${Math.abs(bpBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </span>
            )}
          </div>
        </div>

        {/* Chart */}
        <div style={{ width: '100%', height: chartHeight, marginTop: '0.75rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={heroChartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#30a46c" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#30a46c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="heroExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e5484d" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#e5484d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' } as any}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd" height={24}
              />
              <YAxis hide />
              <Tooltip
                content={(props) => <PillTooltip {...props} isBalanceHidden={isBalanceHidden} />}
                position={{ y: chartHeight - 60 }}
                wrapperStyle={{ display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}
              />
              <Area type="monotone" dataKey="income"   stroke="#30a46c" strokeWidth={2} fill="url(#heroIncome)"   dot={false} activeDot={{ r: 4, fill: '#30a46c',  strokeWidth: 0 }} />
              <Area type="monotone" dataKey="expenses" stroke="#e5484d" strokeWidth={2} fill="url(#heroExpenses)" dot={false} activeDot={{ r: 4, fill: '#e5484d', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Period selector — right aligned, scrollable on mobile */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1px', padding: `0.4rem ${hPad}`, borderTop: '1px solid color-mix(in srgb, var(--border) 60%, transparent)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
          {TIME_PERIODS.map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              style={{
                padding: isMobileHero ? '4px 9px' : '5px 12px',
                fontSize: isMobileHero ? '0.72rem' : '0.78rem',
                fontWeight: selectedPeriod === period ? 700 : 500,
                borderRadius: '999px', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                background: selectedPeriod === period ? 'var(--foreground)' : 'transparent',
                color:      selectedPeriod === period ? 'var(--background)' : 'var(--muted-foreground)',
                WebkitTapHighlightColor: 'transparent',
                flexShrink: 0,
              }}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: `0 ${hPad} 1rem` }}>
          {[
            { color: '#30a46c', label: 'Income',   value: heroStats.totalIncome   },
            { color: '#e5484d', label: 'Expenses', value: heroStats.totalExpenses },
          ].map(({ color, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                {label} · {fmtOrHide(value)}
              </span>
            </div>
          ))}
          {hasBp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-orange-400)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                Meal vouchers · {fmtOrHide(bpBalance ?? 0)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CATEGORY CHART ─────────────────────────────────────────────────────────
  const allExpensesTotal = useMemo(() =>
    transactions.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  const expensesByCategory = useMemo(() => {
    type CategoryData = { name: string; value: number; color: string; icon: string };
    const map = new Map<string, CategoryData>();
    transactions.filter(t => t.type === 'expense' && !isInvestment(t)).forEach(t => {
      const cat = t.category;
      if (!cat) return;
      const existing = map.get(String(cat.id));
      if (existing) { existing.value += t.amount; }
      else map.set(String(cat.id), { name: cat.name, value: t.amount, color: cat.color, icon: cat.icon || '📦' });
    });
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((item, i) => ({ ...item, color: COLORS[i % COLORS.length] }));
  }, [transactions]);

  const total    = allExpensesTotal;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const innerRadius = isMobile ? 55 : 80;
  const outerRadius = isMobile ? 80 : 115;

  return (
    <div className="liquid-glass" style={{ borderRadius: '16px', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Expenses by category</h3>
        <div style={{ background: 'var(--muted)', borderRadius: '999px', padding: '3px', display: 'flex', gap: '2px' }}>
          {(['pie', 'bar'] as const).map(type => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              style={{
                position: 'relative',
                padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600,
                borderRadius: '999px', border: 'none', cursor: 'pointer', transition: 'color 0.2s',
                background: 'transparent',
                color: chartType === type ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              {chartType === type && (
                <span style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: 'var(--background)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{type === 'pie' ? 'Donut' : 'Bar'}</span>
            </button>
          ))}
        </div>
      </div>

      {chartType === 'pie' && expensesByCategory.length > 0 && (
        <div>
          <div style={{ width: '100%', height: isMobile ? 180 : 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expensesByCategory} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={3} dataKey="value" animationDuration={800}>
                  {expensesByCategory.map((entry, i) => <Cell key={i} fill={entry.color} style={{ cursor: 'pointer' }} />)}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, fill: 'var(--foreground)' }}>
                  {isBalanceHidden ? '€•••••' : `€${total.toLocaleString('en-US')}`}
                </text>
                <Tooltip content={<CategoryTooltip isBalanceHidden={isBalanceHidden} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '0.5rem' }}>
            {expensesByCategory.map(item => {
              const percent = total ? ((item.value / total) * 100).toFixed(1) : '0';
              return (
                <div
                  key={item.name}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: '8px', background: 'var(--accent)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.color }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.icon} {item.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                      {isBalanceHidden ? '€•••••' : `€${item.value.toLocaleString('en-US')}`}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: 0 }}>
                      {isBalanceHidden ? '••%' : `${percent}%`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {chartType === 'bar' && expensesByCategory.length > 0 && (
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
          <BarChart data={expensesByCategory} margin={{ top: 5, right: 5, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' } as any} angle={-35} textAnchor="end" interval={0} stroke="transparent" />
            <YAxis tick={isBalanceHidden ? false : { fontSize: 10, fill: 'var(--muted-foreground)' } as any} stroke="transparent" />
            <Tooltip content={<CategoryTooltip isBalanceHidden={isBalanceHidden} />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
              {expensesByCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {expensesByCategory.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
          <span className="animate-subtle-pulse" style={{ display: 'inline-block', fontSize: '1.5rem', marginBottom: '0.5rem' }}>💸</span>
          <p style={{ margin: 0 }}>No expense data for this period</p>
        </div>
      )}
    </div>
  );
};