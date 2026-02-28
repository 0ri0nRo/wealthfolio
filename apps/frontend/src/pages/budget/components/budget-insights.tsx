import { BudgetTransaction } from '@/lib/types/budget';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  RadialBar, RadialBarChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface BudgetInsightsProps {
  transactions: BudgetTransaction[];
  allTransactions: BudgetTransaction[];
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  isBalanceHidden?: boolean;
}

const isInvestment = (t: BudgetTransaction) => {
  if (!t.category) return false;
  const n = t.category.name.toLowerCase();
  return n.includes('invest') || n.includes('crypto') || n.includes('etf') || n.includes('stock');
};

function useIsMobileInsights(bp = 768) {
  const [is, setIs] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setIs(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return is;
}

const makeChartTooltip = (isBalanceHidden: boolean, prefix = '€', suffix = '') =>
  ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="liquid-glass" style={{ borderRadius: '10px', padding: '9px 13px', fontSize: '12px' }}>
        {label && <p style={{ color: 'var(--muted-foreground)', marginBottom: 4, fontWeight: 500 }}>{label}</p>}
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color ?? p.fill ?? 'var(--foreground)', margin: '2px 0', fontWeight: 600 }}>
            {p.name}:{' '}
            {isBalanceHidden
              ? `${prefix}••••`
              : `${prefix}${typeof p.value === 'number' ? p.value.toLocaleString('en-US', { minimumFractionDigits: 0 }) : p.value}${suffix}`}
          </p>
        ))}
      </div>
    );
  };

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; minHeight?: number }> = ({
  title, subtitle, children, minHeight = 260,
}) => (
  <div style={{
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '1.1rem 1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  }}>
    <div style={{ marginBottom: '0.9rem' }}>
      <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: '2px 0 0', fontWeight: 500 }}>{subtitle}</p>}
    </div>
    <div style={{ minHeight }}>{children}</div>
  </div>
);

const Badge: React.FC<{ value: string; positive?: boolean }> = ({ value, positive }) => (
  <span style={{
    fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
    background: positive === undefined
      ? 'var(--muted)'
      : positive
        ? 'color-mix(in srgb, var(--success) 12%, var(--background))'
        : 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
    color: positive === undefined ? 'var(--muted-foreground)' : positive ? 'var(--success)' : 'var(--destructive)',
  }}>{value}</span>
);

export const BudgetInsights: React.FC<BudgetInsightsProps> = ({
  transactions, allTransactions, totalIncome, totalExpenses, isBalanceHidden = false,
}) => {
  const isMobile = useIsMobileInsights();
  const ChartTooltip = useMemo(() => makeChartTooltip(isBalanceHidden), [isBalanceHidden]);

  // 1. Savings rate
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
  const expenseRate = 100 - Math.max(savingsRate, 0);
  const radialData  = [
    { name: 'Expenses', value: expenseRate,              fill: 'var(--destructive)' },
    { name: 'Savings',  value: Math.max(savingsRate, 0), fill: 'var(--success)'     },
  ];

  // 2. Daily spending — last 30 days
  const dailySpending = useMemo(() => {
    const now  = new Date();
    const days: { label: string; amount: number; date: Date }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({ label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), amount: 0, date: d });
    }
    allTransactions.filter(t => t.type === 'expense' && !isInvestment(t)).forEach(t => {
      const td  = new Date(t.date);
      const idx = days.findIndex(d =>
        d.date.getFullYear() === td.getFullYear() &&
        d.date.getMonth()    === td.getMonth()    &&
        d.date.getDate()     === td.getDate()
      );
      if (idx !== -1) days[idx].amount += t.amount;
    });
    return days;
  }, [allTransactions]);

  const avgDailySpend = dailySpending.length
    ? dailySpending.reduce((s, d) => s + d.amount, 0) / dailySpending.length
    : 0;

  // 3. Monthly comparison — last 6 months
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString('en-GB', { month: 'short' });
      let income = 0, expenses = 0;
      allTransactions.filter(t => {
        const td = new Date(t.date);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      }).forEach(t => {
        if (t.type === 'income') income += t.amount;
        if (t.type === 'expense' && !isInvestment(t)) expenses += t.amount;
      });
      return { label, income, expenses };
    });
  }, [allTransactions]);

  // 4. Top categories
  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; amount: number; count: number }>();
    transactions.filter(t => t.type === 'expense' && !isInvestment(t)).forEach(t => {
      const cat = t.category;
      if (!cat) return;
      const key = String(cat.id);
      const ex  = map.get(key);
      if (ex) { ex.amount += t.amount; ex.count++; }
      else map.set(key, { name: cat.name, icon: cat.icon ?? '📦', amount: t.amount, count: 1 });
    });
    const total = [...map.values()].reduce((s, c) => s + c.amount, 0);
    return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 5)
      .map(c => ({ ...c, pct: total > 0 ? (c.amount / total) * 100 : 0 }));
  }, [transactions]);

  // 5. Spending by day of week
  const byDayOfWeek = useMemo(() => {
    const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    const totals = new Array(7).fill(0);
    allTransactions.filter(t => t.type === 'expense' && !isInvestment(t)).forEach(t => {
      const dow = new Date(t.date).getDay();
      totals[dow] += t.amount;
      counts[dow]++;
    });
    return days.map((label, i) => ({ label, avg: counts[i] > 0 ? Math.round(totals[i] / counts[i]) : 0 }));
  }, [allTransactions]);

  const maxDow   = Math.max(...byDayOfWeek.map(d => d.avg), 1);
  const axisTick = { fontSize: 10, fill: 'var(--muted-foreground)' } as any;

  const yTickFmt       = (v: number) => isBalanceHidden ? '•••' : `€${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;
  const yTickFmtSimple = (v: number) => isBalanceHidden ? '•••' : `€${v}`;

  // Category progress bar colors — from chart palette
  const catColors = ['#f9ae77', '#f89a8a', '#f4a4c2', '#c4b9e0', '#92bfdb'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Row 1: Savings Rate + Monthly Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: '1.25rem' }}>

        <Card title="Savings Rate" subtitle="This month" minHeight={isMobile ? 160 : 200}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '100%', height: isMobile ? 140 : 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="85%" startAngle={210} endAngle={-30} data={radialData} barSize={12}>
                  <RadialBar dataKey="value" background={{ fill: 'var(--muted)' }} cornerRadius={6} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: savingsRate >= 0 ? 'var(--foreground)' : 'var(--destructive)', letterSpacing: '-0.04em' }}>
                  {isBalanceHidden ? '••%' : `${savingsRate}%`}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>saved</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
              {[
                { color: 'var(--destructive)', label: 'Spent', pct: expenseRate       },
                { color: 'var(--success)',     label: 'Saved', pct: Math.max(savingsRate, 0) },
              ].map(({ color, label, pct }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                    {label} {isBalanceHidden ? '••%' : `${pct}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Income vs Expenses" subtitle="Last 6 months" minHeight={isMobile ? 160 : 200}>
          <ResponsiveContainer width="100%" height={isMobile ? 155 : 195}>
            <BarChart data={monthlyComparison} barCategoryGap="28%" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={isBalanceHidden ? false : axisTick} axisLine={false} tickLine={false} width={isBalanceHidden ? 0 : 42} tickFormatter={yTickFmt} />
              <Tooltip content={<ChartTooltip />} />
              {/* Use chart palette colors */}
              <Bar dataKey="income"   name="Income"   fill="#bec97e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#f89a8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 2: Daily spend + Day of week */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: '1.25rem' }}>

        <Card title="Daily Spending" subtitle="Last 30 days" minHeight={isMobile ? 160 : 200}>
          <ResponsiveContainer width="100%" height={isMobile ? 155 : 195}>
            <LineChart data={dailySpending} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
              <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={isBalanceHidden ? false : axisTick} axisLine={false} tickLine={false} width={isBalanceHidden ? 0 : 42} tickFormatter={yTickFmtSimple} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={avgDailySpend}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: isBalanceHidden ? 'avg •••' : `avg €${Math.round(avgDailySpend)}`, position: 'right', fontSize: 9, fill: 'var(--muted-foreground)' }}
              />
              <Line type="monotone" dataKey="amount" name="Spent" stroke="#c4b9e0" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#c4b9e0', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Spending by Weekday" subtitle="Average per transaction" minHeight={200}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
            {byDayOfWeek.map(({ label, avg }) => {
              const barPct    = (avg / maxDow) * 100;
              const isWeekend = label === 'Sat' || label === 'Sun';
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, width: 28, flexShrink: 0, color: isWeekend ? '#c4b9e0' : 'var(--muted-foreground)' }}>
                    {label}
                  </span>
                  <div style={{ flex: 1, background: 'var(--muted)', borderRadius: '999px', height: 7, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '999px', width: `${barPct}%`,
                      background: isWeekend
                        ? 'linear-gradient(90deg, #c4b9e0, #a699d0)'
                        : 'linear-gradient(90deg, #92bfdb, #66a0c8)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 600, width: 38, textAlign: 'right', flexShrink: 0 }}>
                    {isBalanceHidden ? (avg > 0 ? '€••' : '—') : (avg > 0 ? `€${avg}` : '—')}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Row 3: Top categories */}
      <Card title="Top Categories" subtitle="This month · by spend" minHeight={0}>
        {topCategories.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem', textAlign: 'center', padding: '1.5rem 0' }}>No expenses this month</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topCategories.map((cat, idx) => (
              <div key={cat.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ width: 24, height: 24, borderRadius: '7px', background: 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                      {cat.icon}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>{cat.name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>{cat.count} transactions</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {isBalanceHidden ? '€••••' : `€${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </span>
                    <Badge value={`${cat.pct.toFixed(0)}%`} />
                  </div>
                </div>
                <div style={{ background: 'var(--muted)', borderRadius: '999px', height: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '999px', width: `${cat.pct}%`, background: catColors[idx] ?? catColors[0], transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
