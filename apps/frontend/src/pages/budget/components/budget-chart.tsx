import { BudgetTransaction } from '@/lib/types/budget';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BudgetChartProps {
  transactions: BudgetTransaction[];
  showLast12Months?: boolean;
}

const isInvestment = (transaction: BudgetTransaction) => {
  if (!transaction.category) return false;
  const name = transaction.category.name.toLowerCase();
  return (
    name.includes('invest') ||
    name.includes('crypto') ||
    name.includes('etf') ||
    name.includes('stock')
  );
};

// Uses the exact palette defined in global.css @theme
const COLORS = [
  '#f9ae77', // orange-200
  '#87d3c3', // cyan-200
  '#c4b9e0', // purple-200
  '#bec97e', // green-200
  '#92bfdb', // blue-200
  '#f4a4c2', // magenta-200
  '#f89a8a', // red-200
  '#f6e2a0', // yellow-100
];

type TimePeriod = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
const TIME_PERIODS: TimePeriod[] = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];

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
  '1W': 'past week', '1M': 'past month', '3M': 'past 3 months',
  '6M': 'past 6 months', 'YTD': 'year to date', '1Y': 'past year', 'ALL': 'all time',
};

// ── TOOLTIPS ─────────────────────────────────────────────────────────────────
// Uses .liquid-glass from global.css for the frosted-glass look in both
// light and dark mode (CSS vars handle the background/border automatically).

const HeroTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="liquid-glass"
      style={{
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '12px',
      }}
    >
      <p style={{ color: 'var(--muted-foreground)', marginBottom: 4, fontWeight: 500 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke, margin: '2px 0', fontWeight: 600 }}>
          {p.dataKey === 'income' ? 'Income' : 'Expenses'}:{' '}
          €{Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
};

const CategoryTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="liquid-glass"
      style={{
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '12px',
      }}
    >
      <p style={{ color: 'var(--foreground)', fontWeight: 600, margin: '0 0 2px' }}>
        {payload[0]?.payload?.name}
      </p>
      <p style={{ color: 'var(--muted-foreground)', margin: 0 }}>
        €{Number(payload[0]?.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export const BudgetChart: React.FC<BudgetChartProps> = ({
  transactions = [],
  showLast12Months = false,
}) => {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1W');

  // ── HERO CHART DATA ────────────────────────────────────────────────────────
  const heroChartData = useMemo(() => {
    if (!showLast12Months) return [];

    const now = new Date();

    let fromDate = getDateRangeForPeriod(selectedPeriod);
    if (selectedPeriod === 'ALL' && transactions.length > 0) {
      const earliest = transactions.reduce((min, t) => {
        const d = new Date(t.date);
        return d < min ? d : min;
      }, new Date());
      fromDate = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    }

    const isShortPeriod = selectedPeriod === '1W' || selectedPeriod === '1M';

    type DataPoint = { label: string; income: number; expenses: number };
    const points = new Map<string, DataPoint>();

    if (isShortPeriod) {
      const days = selectedPeriod === '1W' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        points.set(key, {
          label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          income: 0, expenses: 0,
        });
      }
    } else {
      let cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      while (cursor <= now) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        points.set(key, {
          label: (() => {
            const spanYears = now.getFullYear() - fromDate.getFullYear();
            if (spanYears > 2) {
              return cursor.getMonth() === 0 ||
                (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth())
                ? cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                : '';
            }
            return cursor.toLocaleDateString('en-GB', {
              month: 'short',
              year: cursor.getFullYear() !== now.getFullYear() ? '2-digit' : undefined,
            });
          })(),
          income: 0, expenses: 0,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }

    transactions
      .filter((t) => new Date(t.date) >= fromDate)
      .forEach((t) => {
        const d = new Date(t.date);
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
    const totalIncome = heroChartData.reduce((s, d) => s + d.income, 0);
    const totalExpenses = heroChartData.reduce((s, d) => s + d.expenses, 0);
    const balance = totalIncome - totalExpenses;
    const balancePct = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    return { totalIncome, totalExpenses, balance, balancePct };
  }, [heroChartData]);

  // ── HERO CHART RENDER ──────────────────────────────────────────────────────
  if (showLast12Months) {
    const isPositive = heroStats.balance >= 0;
    // Gradient adapts automatically: green tint in light, fades to --background in dark
    const heroGradient = `linear-gradient(180deg, color-mix(in srgb, #16a34a 8%, var(--background)) 0%, var(--background) 70%)`;

    return (
      <div style={{ background: heroGradient, position: 'relative' }}>

        {/* Stats */}
        <div style={{ padding: '1.75rem 1.75rem 0' }}>
          <p style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            // animate-subtle-pulse only when income is 0 (no data yet)
            color: 'var(--foreground)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            margin: '0 0 0.45rem',
          }}>
            €{heroStats.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Balance badge — uses animate-subtle-pulse when exactly zero */}
            <span
              className={heroStats.balance === 0 ? 'animate-subtle-pulse' : ''}
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: isPositive ? '#16a34a' : '#dc2626',
              }}
            >
              {isPositive ? '+' : ''}€{heroStats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: isPositive ? '#16a34a' : '#dc2626',
            }}>
              {isPositive ? '+' : ''}{heroStats.balancePct.toFixed(2)}%
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
              {PERIOD_LABEL[selectedPeriod]}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div style={{ width: '100%', height: 220, marginTop: '1rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={heroChartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="heroExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' } as any}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                height={28}
              />
              <YAxis hide />
              <Tooltip content={<HeroTooltip />} />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#16a34a"
                strokeWidth={2}
                fill="url(#heroIncome)"
                dot={false}
                activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#heroExpenses)"
                dot={false}
                activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Period selector */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2px',
          padding: '0.5rem 1.75rem 0.75rem',
          borderTop: '1px solid var(--border)',
        }}>
          {TIME_PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              style={{
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: selectedPeriod === period ? 700 : 500,
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: selectedPeriod === period ? 'var(--foreground)' : 'transparent',
                color: selectedPeriod === period ? 'var(--background)' : 'var(--muted-foreground)',
              }}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.5rem', padding: '0 1.75rem 1.25rem' }}>
          {[
            { color: '#16a34a', label: 'Income', value: heroStats.totalIncome },
            { color: '#ef4444', label: 'Expenses', value: heroStats.totalExpenses },
          ].map(({ color, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                {label} · €{value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── CATEGORY CHART ─────────────────────────────────────────────────────────
  const expensesByCategory = useMemo(() => {
    type CategoryData = { name: string; value: number; color: string; icon: string };
    const categoryMap = new Map<string, CategoryData>();

    transactions
      .filter((t) => t.type === 'expense' && !isInvestment(t))
      .forEach((transaction) => {
        const category = transaction.category;
        if (!category) return;
        const existing = categoryMap.get(String(category.id));
        if (existing) {
          existing.value += transaction.amount;
        } else {
          categoryMap.set(String(category.id), {
            name: category.name,
            value: transaction.amount,
            color: category.color,
            icon: category.icon || '📦',
          });
        }
      });

    return Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }));
  }, [transactions]);

  const total = expensesByCategory.reduce((sum, item) => sum + item.value, 0);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const innerRadius = isMobile ? 55 : 80;
  const outerRadius = isMobile ? 80 : 115;

  return (
    // liquid-glass gives the frosted-card look; CSS vars inside it adapt to .dark automatically
    <div
      className="liquid-glass"
      style={{
        borderRadius: '16px',
        padding: '1.25rem',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <h3 style={{
          fontSize: '0.9rem',
          fontWeight: 700,
          color: 'var(--foreground)',
          margin: 0,
        }}>
          Expenses by category
        </h3>

        {/* Chart type toggle — uses --muted / --card CSS vars */}
        <div style={{
          background: 'var(--muted)',
          borderRadius: '10px',
          padding: '3px',
          display: 'flex',
          gap: '2px',
        }}>
          {(['pie', 'bar'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: chartType === type ? 'var(--card)' : 'transparent',
                color: chartType === type ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: chartType === type ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {type === 'pie' ? 'Donut' : 'Bar'}
            </button>
          ))}
        </div>
      </div>

      {/* ── DONUT CHART ───────────────────────────────────────────────────── */}
      {chartType === 'pie' && expensesByCategory.length > 0 && (
        <div>
          <div style={{ width: '100%', height: isMobile ? 180 : 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={index} fill={entry.color} style={{ cursor: 'pointer' }} />
                  ))}
                </Pie>
                {/* Center label — color via CSS var so it flips in dark mode */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontSize: isMobile ? '1rem' : '1.1rem',
                    fontWeight: 700,
                    fill: 'var(--foreground)',
                  }}
                >
                  €{total.toLocaleString('en-US')}
                </text>
                <Tooltip content={<CategoryTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '0.5rem' }}>
            {expensesByCategory.map((item) => {
              const percent = total ? ((item.value / total) * 100).toFixed(1) : '0';
              return (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    // --accent is the hover-ready muted surface in both themes
                    background: 'var(--accent)',
                    cursor: 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: item.color,
                    }} />
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.icon} {item.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                      €{item.value.toLocaleString('en-US')}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: 0 }}>
                      {percent}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BAR CHART ─────────────────────────────────────────────────────── */}
      {chartType === 'bar' && expensesByCategory.length > 0 && (
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
          <BarChart
            data={expensesByCategory}
            margin={{ top: 5, right: 5, left: 0, bottom: 50 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' } as any}
              angle={-35}
              textAnchor="end"
              interval={0}
              stroke="transparent"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' } as any}
              stroke="transparent"
            />
            <Tooltip content={<CategoryTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
              {expensesByCategory.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Empty state — uses animate-subtle-pulse on the icon for a living feel */}
      {expensesByCategory.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: 'var(--muted-foreground)',
          fontSize: '0.85rem',
        }}>
          <span className="animate-subtle-pulse" style={{ display: 'inline-block', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            💸
          </span>
          <p style={{ margin: 0 }}>No expense data for this period</p>
        </div>
      )}
    </div>
  );
};
