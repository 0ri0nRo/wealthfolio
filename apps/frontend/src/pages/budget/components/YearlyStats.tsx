// src/pages/budget/components/YearlyStats.tsx
import { BudgetTransaction } from '@/lib/types/budget';
import { RecurringExpense, RecurringExpenseEntry, isRecurringActiveInMonth } from '@/lib/types/recurring';
import {
  ArrowLeft, ArrowUpRight, BarChart2, CalendarDays,
  GitCompare, Sparkles, TrendingDown, TrendingUp, Wallet
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// ─── helpers ──────────────────────────────────────────────────────────────────
const isInvestment = (t: BudgetTransaction) => {
  if (!t.category) return false;
  const n = t.category.name.toLowerCase();
  return n.includes('invest') || n.includes('crypto') || n.includes('etf') || n.includes('stock');
};

const fmtEur = (n: number, dec = 0) =>
  `€${n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;

const fmtCompact = (n: number) =>
  Math.abs(n) >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${n}`;

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CAT_COLORS = [
  'var(--color-orange-400)',
  'var(--color-blue-600)',
  'var(--color-purple-600)',
  '#87d3c3',
  '#bec97e',
  '#f4a4c2',
  '#f89a8a',
  '#f6e2a0',
];

const YEAR_COLORS = ['#2563eb','#16a34a','#dc2626','#7c3aed','#d97706'];

function useIsMobile(bp = 768) {
  const [is, setIs] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setIs(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return is;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface RecurringWithEntries {
  recurringExpense: RecurringExpense;
  entries: RecurringExpenseEntry[];
}

interface YearlyStatsProps {
  allTransactions: BudgetTransaction[];
  allRecurringEntries?: RecurringWithEntries[];
  onBack?: () => void;
  hideNav?: boolean;
}

// ─── Recurring helpers ────────────────────────────────────────────────────────
function getRecurringAmountForMonth(rwe: RecurringWithEntries, year: number, month: number): number {
  const entry = rwe.entries.find(e => e.year === year && e.month === month);
  if (entry) return entry.amount;
  if (isRecurringActiveInMonth(rwe.recurringExpense, year, month)) return rwe.recurringExpense.amount;
  return 0;
}

function getTotalRecurringForMonth(allRec: RecurringWithEntries[], year: number, month: number): number {
  return allRec.reduce((s, rwe) => s + getRecurringAmountForMonth(rwe, year, month), 0);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '9px 13px',
      fontSize: '0.75rem',
      minWidth: 130,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      {label && (
        <p style={{ color: 'var(--muted-foreground)', marginBottom: 6, fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </p>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color ?? p.fill ?? 'var(--foreground)', flexShrink: 0 }} />
          <span style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}>{p.name}:</span>
          <span style={{ color: 'var(--foreground)', fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>
            {typeof p.value === 'number'
              ? `€${Math.abs(p.value).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────
const ChartEmptyState: React.FC<{ height?: number; message?: string }> = ({
  height = 200,
  message = 'No data for this period',
}) => (
  <div style={{
    height,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted-foreground)',
    fontSize: '0.8rem',
    gap: 6,
    background: 'var(--accent)',
    borderRadius: 10,
  }}>
    <span style={{ fontSize: '1.4rem', opacity: 0.5 }}>📊</span>
    {message}
  </div>
);

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <h2 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.015em' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>{subtitle}</p>}
    </div>
  </div>
);

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
  legend?: React.ReactNode;
}> = ({ title, subtitle, children, icon, action, style, legend }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', ...style }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && (
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
            {icon}
          </div>
        )}
        <div>
          <h3 style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>{subtitle}</p>}
        </div>
      </div>
      {legend && <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>{legend}</div>}
      {action && !legend && <div>{action}</div>}
    </div>
    <div style={{ padding: '1rem 1.1rem' }}>{children}</div>
  </div>
);

// ─── Legend dot ───────────────────────────────────────────────────────────────
const LegendDot: React.FC<{ color: string; label: string; value?: number; square?: boolean }> = ({ color, label, value, square }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    <div style={{ width: 7, height: 7, borderRadius: square ? 2 : '50%', background: color, flexShrink: 0 }} />
    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
      {label}{value !== undefined && <> · <strong style={{ color: 'var(--foreground)' }}>{fmtEur(value)}</strong></>}
    </span>
  </div>
);

// ─── Shared axis/grid props ───────────────────────────────────────────────────
const axisTick = { fontSize: 10, fill: 'var(--muted-foreground)' } as any;
const tickFmt  = (v: number) => `€${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(0)}k` : v}`;
const gridProps = { strokeDasharray: '3 3' as const, opacity: 0.06, vertical: false };

// ─── Month / Year chip selectors ──────────────────────────────────────────────
const MonthChips: React.FC<{ selected: number[]; onChange: (v: number[]) => void }> = ({ selected, onChange }) => {
  const toggle = (m: number) => {
    if (selected.includes(m)) { if (selected.length === 1) return; onChange(selected.filter(x => x !== m)); }
    else onChange([...selected, m].sort((a, b) => a - b));
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {MONTH_LABELS.map((label, i) => (
        <button key={i} onClick={() => toggle(i)} style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.12s', borderColor: selected.includes(i) ? 'var(--foreground)' : 'var(--border)', background: selected.includes(i) ? 'var(--foreground)' : 'transparent', color: selected.includes(i) ? 'var(--background)' : 'var(--muted-foreground)' }}>{label}</button>
      ))}
      {selected.length < 12 && (
        <button onClick={() => onChange(MONTH_LABELS.map((_, i) => i))} style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: '1.5px dashed var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--muted-foreground)' }}>All</button>
      )}
    </div>
  );
};

const YearChips: React.FC<{ years: number[]; selected: number[]; onChange: (v: number[]) => void; max?: number }> = ({ years, selected, onChange, max = 5 }) => {
  const toggle = (y: number) => {
    if (selected.includes(y)) { if (selected.length === 1) return; onChange(selected.filter(x => x !== y)); }
    else { if (selected.length >= max) return; onChange([...selected, y].sort((a, b) => a - b)); }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {years.map((y, i) => {
        const color = YEAR_COLORS[i % YEAR_COLORS.length];
        const sel = selected.includes(y);
        return (
          <button key={y} onClick={() => toggle(y)} style={{ padding: '4px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: 999, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.12s', borderColor: sel ? color : 'var(--border)', background: sel ? `color-mix(in srgb, ${color} 12%, var(--background))` : 'transparent', color: sel ? color : 'var(--muted-foreground)' }}>{y}</button>
        );
      })}
    </div>
  );
};

// ─── YoY badge ────────────────────────────────────────────────────────────────
const YoyBadge: React.FC<{ label: string; value: number; positiveIsGood: boolean }> = ({ label, value, positiveIsGood }) => {
  const isGood = positiveIsGood ? value > 0 : value < 0;
  const color  = isGood ? 'var(--success)' : 'var(--destructive)';
  const bg     = isGood ? 'color-mix(in srgb, var(--success) 10%, var(--background))' : 'color-mix(in srgb, var(--destructive) 10%, var(--background))';
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: bg, color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
      {label} {value > 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
};

// ─── Year picker ──────────────────────────────────────────────────────────────
const YearPicker: React.FC<{ years: number[]; selected: number; onChange: (y: number) => void; layoutId: string; small?: boolean }> = ({ years, selected, onChange, layoutId, small }) => (
  <div style={{ display: 'flex', gap: 2, background: 'color-mix(in srgb, var(--muted) 60%, transparent)', borderRadius: 999, padding: 3 }}>
    {years.map(y => {
      const isActive = selected === y;
      return (
        <button key={y} onClick={() => onChange(y)} style={{ position: 'relative', padding: small ? '3px 10px' : '4px 12px', fontSize: small ? '0.75rem' : '0.78rem', fontWeight: isActive ? 700 : 500, borderRadius: 999, border: 'none', cursor: 'pointer', background: 'transparent', color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent', transition: 'color 0.2s' }}>
          {isActive && (
            <motion.div layoutId={`year-pill-${layoutId}`}
              style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--background)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              initial={false} transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          <span style={{ position: 'relative', zIndex: 10 }}>{y}</span>
        </button>
      );
    })}
  </div>
);

type PeriodPreset = 'full' | 'h1' | 'h2' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom';
const PERIOD_PRESETS: { value: PeriodPreset; label: string; months: number[] }[] = [
  { value: 'full', label: 'Full year', months: [0,1,2,3,4,5,6,7,8,9,10,11] },
  { value: 'h1',   label: 'H1',        months: [0,1,2,3,4,5] },
  { value: 'h2',   label: 'H2',        months: [6,7,8,9,10,11] },
  { value: 'q1',   label: 'Q1',        months: [0,1,2] },
  { value: 'q2',   label: 'Q2',        months: [3,4,5] },
  { value: 'q3',   label: 'Q3',        months: [6,7,8] },
  { value: 'q4',   label: 'Q4',        months: [9,10,11] },
  { value: 'custom', label: 'Custom',  months: [] },
];

type CompareMetric = 'expenses' | 'income' | 'net';

// ─── Stat pill ────────────────────────────────────────────────────────────────
interface StatPill {
  label: string;
  value: string;
  sub?: string;
  subGood?: boolean;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
}

const StatPillRow: React.FC<{ pills: StatPill[]; isMobile: boolean }> = ({ pills, isMobile }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
    gap: 8,
    marginBottom: '1.5rem',
  }}>
    {pills.map(({ label, value, sub, subGood, icon, iconColor, iconBg }, idx) => (
      <div key={label} style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 12px 8px 8px',
        borderRadius: 999,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        ...(isMobile && idx === 4 ? { gridColumn: 'span 2', justifySelf: 'start' as const } : {}),
        transition: 'background 0.15s',
        cursor: 'default',
      }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
      >
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '0.58rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: iconColor, margin: 0, letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>{value}</p>
          {sub && (
            <p style={{ fontSize: '0.58rem', fontWeight: 600, color: subGood === true ? 'var(--success)' : subGood === false ? 'var(--destructive)' : 'var(--muted-foreground)', margin: '1px 0 0', whiteSpace: 'nowrap' }}>
              {sub}
            </p>
          )}
        </div>
      </div>
    ))}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export const YearlyStats: React.FC<YearlyStatsProps> = ({
  allTransactions,
  allRecurringEntries = [],
  onBack,
  hideNav = false,
}) => {
  const isMobile  = useIsMobile();
  const yearNavId = useId();

  const availableYears = useMemo(() => {
    const s = new Set(allTransactions.map(t => new Date(t.date).getFullYear()));
    allRecurringEntries.forEach(rwe => {
      rwe.entries.forEach(e => s.add(e.year));
      s.add(new Date(rwe.recurringExpense.startDate).getFullYear());
    });
    return Array.from(s).sort((a, b) => b - a);
  }, [allTransactions, allRecurringEntries]);

  const currentYear = new Date().getFullYear();

  const [selectedYear,      setSelectedYear]      = useState(availableYears.includes(currentYear) ? currentYear : (availableYears[0] ?? currentYear));
  const [periodPreset,      setPeriodPreset]      = useState<PeriodPreset>('full');
  const [customMonths,      setCustomMonths]      = useState<number[]>([0,1,2,3,4,5,6,7,8,9,10,11]);
  const [compareYears,      setCompareYears]      = useState<number[]>(() => availableYears.slice(0, Math.min(2, availableYears.length)));
  const [compareMetric,     setCompareMetric]     = useState<CompareMetric>('expenses');
  const [compareMonths,     setCompareMonths]     = useState<number[]>([new Date().getMonth()]);
  const [compareMonthYears, setCompareMonthYears] = useState<number[]>(() => availableYears.slice(0, Math.min(2, availableYears.length)));

  const activeMonths = useMemo(() => {
    if (periodPreset === 'custom') return customMonths;
    return PERIOD_PRESETS.find(p => p.value === periodPreset)?.months ?? [0,1,2,3,4,5,6,7,8,9,10,11];
  }, [periodPreset, customMonths]);

  const yearTx = useMemo(() =>
    allTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && activeMonths.includes(d.getMonth());
    }),
    [allTransactions, selectedYear, activeMonths]);

  const prevYearTx = useMemo(() =>
    allTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear - 1 && activeMonths.includes(d.getMonth());
    }),
    [allTransactions, selectedYear, activeMonths]);

  const yearRecurringTotal = useMemo(() =>
    activeMonths.reduce((s, m) => s + getTotalRecurringForMonth(allRecurringEntries, selectedYear, m + 1), 0),
    [allRecurringEntries, selectedYear, activeMonths]);

  const prevYearRecurringTotal = useMemo(() =>
    activeMonths.reduce((s, m) => s + getTotalRecurringForMonth(allRecurringEntries, selectedYear - 1, m + 1), 0),
    [allRecurringEntries, selectedYear, activeMonths]);

  const kpis = useMemo(() => {
    const income      = yearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const txExpenses  = yearTx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    // FIX: expenses = living expenses only (recurring included); invested is tracked separately
    const expenses    = txExpenses + yearRecurringTotal;
    const invested    = yearTx.filter(t => isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    // FIX: balance = income minus ALL outgoing (expenses + investments = actual cash left)
    const balance     = income - expenses - invested;
    // Saving rate: % of income not spent on living expenses (investments count as "saved/invested")
    const savRate     = income > 0 ? ((income - expenses) / income) * 100 : 0;
    // Invest rate: % of income going to investments
    const investRate  = income > 0 ? (invested / income) * 100 : 0;
    const prevInc     = prevYearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevTxExp   = prevYearTx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    const prevExp     = prevTxExp + prevYearRecurringTotal;
    const yoyInc      = prevInc > 0 ? ((income   - prevInc) / prevInc)  * 100 : null;
    const yoyExp      = prevExp > 0 ? ((expenses - prevExp) / prevExp)  * 100 : null;
    return { income, expenses, invested, balance, savRate, investRate, yoyInc, yoyExp };
  }, [yearTx, prevYearTx, yearRecurringTotal, prevYearRecurringTotal]);

  // FIX: monthly data now exposes `txExpenses` (living expenses without recurring)
  // separately from `expenses` (total = txExpenses + recurring) so the stacked bar
  // doesn't double-count recurring.
  const monthly = useMemo(() =>
    MONTH_LABELS.map((label, m) => {
      if (!activeMonths.includes(m)) return null;
      const mx         = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === selectedYear && d.getMonth() === m; });
      const income     = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const txExpenses = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      const recExp     = getTotalRecurringForMonth(allRecurringEntries, selectedYear, m + 1);
      const expenses   = txExpenses + recExp;  // total living expenses
      const invested   = mx.filter(t => isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      // FIX: net = income - expenses - invested (actual cash left)
      return { label, income, txExpenses, recurring: recExp, expenses, invested, net: income - expenses - invested };
    }).filter(Boolean) as { label: string; income: number; txExpenses: number; recurring: number; expenses: number; invested: number; net: number }[],
    [allTransactions, allRecurringEntries, selectedYear, activeMonths]);

  const cumulative = useMemo(() => {
    let r = 0;
    return monthly.map(m => { r += m.net; return { label: m.label, cumulative: r }; });
  }, [monthly]);

  const catBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; amount: number; count: number }>();
    yearTx.filter(t => t.type === 'expense' && !isInvestment(t)).forEach(t => {
      if (!t.category) return;
      const k = String(t.category.id);
      const ex = map.get(k);
      if (ex) { ex.amount += t.amount; ex.count++; }
      else map.set(k, { name: t.category.name, icon: t.category.icon ?? '📦', amount: t.amount, count: 1 });
    });
    allRecurringEntries.forEach(rwe => {
      const amount = activeMonths.reduce((s, m) => s + getRecurringAmountForMonth(rwe, selectedYear, m + 1), 0);
      if (amount <= 0) return;
      const catId = String(rwe.recurringExpense.categoryId);
      const ex = map.get(catId);
      if (ex) { ex.amount += amount; ex.count++; }
      else map.set(catId, { name: rwe.recurringExpense.description, icon: '🔁', amount, count: 1 });
    });
    const total = [...map.values()].reduce((s, c) => s + c.amount, 0);
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((c, i) => ({ ...c, pct: total > 0 ? (c.amount / total) * 100 : 0, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [yearTx, allRecurringEntries, selectedYear, activeMonths]);

  // FIX: streak now respects activeMonths instead of always scanning all 12 months
  const streak = useMemo(() => {
    const nets = activeMonths.map(m => {
      const mx     = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === selectedYear && d.getMonth() === m; });
      const income = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const txExp  = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      const recExp = getTotalRecurringForMonth(allRecurringEntries, selectedYear, m + 1);
      const inv    = mx.filter(t => isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      return income - txExp - recExp - inv;
    });
    let s = 0;
    for (let i = nets.length - 1; i >= 0; i--) { if (nets[i] > 0) s++; else break; }
    return s;
  }, [allTransactions, allRecurringEntries, selectedYear, activeMonths]);

  const bestMonth  = monthly.length ? monthly.reduce((a, b) => b.net > a.net ? b : a) : null;
  const worstMonth = monthly.length ? monthly.reduce((a, b) => b.net < a.net ? b : a) : null;
  const posMonths  = monthly.filter(m => m.net > 0).length;
  const negMonths  = monthly.filter(m => m.net < 0).length;
  const avgMonthly = monthly.length ? monthly.reduce((s, m) => s + m.net, 0) / monthly.length : 0;

  // FIX: compareData now respects activeMonths — only include selected months
  const compareData = useMemo(() =>
    MONTH_LABELS
      .map((label, m) => {
        if (!activeMonths.includes(m)) return null;
        const row: Record<string, any> = { label };
        compareYears.forEach(y => {
          const mx     = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; });
          const inc    = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const txExp  = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
          const recExp = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
          const exp    = txExp + recExp;
          row[String(y)] = Math.round(compareMetric === 'income' ? inc : compareMetric === 'net' ? inc - exp : exp);
        });
        return row;
      })
      .filter(Boolean) as Record<string, any>[],
    [allTransactions, allRecurringEntries, compareYears, compareMetric, activeMonths]);

  const monthCompareData = useMemo(() =>
    compareMonthYears.map(y => {
      const row: Record<string, any> = { label: String(y) };
      compareMonths.forEach(m => {
        const mx     = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); });
        const txAmt  = mx.reduce((s, t) => s + t.amount, 0);
        const recAmt = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
        row[MONTH_LABELS[m]] = Math.round(txAmt + recAmt);
      });
      return row;
    }),
    [allTransactions, allRecurringEntries, compareMonths, compareMonthYears]);

  // FIX: cumCompareData also respects activeMonths
  const cumCompareData = useMemo(() =>
    MONTH_LABELS
      .map((label, m) => {
        if (!activeMonths.includes(m)) return null;
        const row: Record<string, any> = { label };
        compareYears.forEach(y => {
          // accumulate only over activeMonths up to and including m
          const running = activeMonths
            .filter(mm => mm <= m)
            .reduce((acc, mm) => {
              const mx     = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === mm; });
              const inc    = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
              const txExp  = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
              const recExp = getTotalRecurringForMonth(allRecurringEntries, y, mm + 1);
              return acc + inc - txExp - recExp;
            }, 0);
          row[String(y)] = Math.round(running);
        });
        return row;
      })
      .filter(Boolean) as Record<string, any>[],
    [allTransactions, allRecurringEntries, compareYears, activeMonths]);

  const periodLabel = periodPreset === 'custom'
    ? activeMonths.length === 12 ? 'Full year' : `${MONTH_LABELS[activeMonths[0]]}–${MONTH_LABELS[activeMonths[activeMonths.length - 1]]}`
    : PERIOD_PRESETS.find(p => p.value === periodPreset)?.label ?? '';

  // ── Metric toggle ─────────────────────────────────────────────────────────
  const MetricToggle = () => (
    <div style={{ display: 'inline-flex', background: 'color-mix(in srgb, var(--muted) 60%, transparent)', borderRadius: 999, padding: 3, gap: 2 }}>
      {(['expenses','income','net'] as CompareMetric[]).map(m => (
        <button key={m} onClick={() => setCompareMetric(m)} style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', background: compareMetric === m ? 'var(--background)' : 'transparent', color: compareMetric === m ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: compareMetric === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', fontFamily: 'var(--font-sans)' }}>
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );

  // ── KPI pills — FIX: removed duplicate "Saving streak" pill, replaced with Income ──
  const statPills: StatPill[] = [
    {
      label: 'Income',
      value: fmtEur(kpis.income),
      sub: kpis.yoyInc !== null ? `${kpis.yoyInc > 0 ? '+' : ''}${kpis.yoyInc.toFixed(1)}% vs last year` : undefined,
      subGood: kpis.yoyInc !== null ? kpis.yoyInc > 0 : undefined,
      icon: <TrendingUp size={14} />,
      iconColor: 'var(--success)',
      iconBg: 'color-mix(in srgb, var(--success) 12%, var(--background))',
    },
    {
      label: 'Expenses',
      value: fmtEur(kpis.expenses),
      sub: kpis.yoyExp !== null ? `${kpis.yoyExp > 0 ? '+' : ''}${kpis.yoyExp.toFixed(1)}% vs last year` : undefined,
      subGood: kpis.yoyExp !== null ? kpis.yoyExp < 0 : undefined,
      icon: <TrendingDown size={14} />,
      iconColor: 'var(--destructive)',
      iconBg: 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
    },
    {
      label: 'Invested',
      value: fmtEur(kpis.invested),
      sub: kpis.invested > 0 && kpis.income > 0 ? `${kpis.investRate.toFixed(1)}% of income` : undefined,
      icon: <TrendingUp size={14} />,
      iconColor: 'var(--color-purple-600)',
      iconBg: 'color-mix(in srgb, var(--color-purple-600) 12%, var(--background))',
    },
    {
      // FIX: balance now = income - expenses - invested (true cash left)
      label: 'Cash left',
      value: `${kpis.balance >= 0 ? '+' : ''}${fmtEur(kpis.balance)}`,
      sub: `avg ${fmtCompact(Math.round(avgMonthly))}/mo`,
      icon: <Wallet size={14} />,
      iconColor: kpis.balance >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)',
      iconBg: kpis.balance >= 0
        ? 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))'
        : 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
    },
    {
      label: 'Positive months',
      value: `${posMonths} / ${monthly.length}`,
      sub: negMonths > 0 ? `${negMonths} negative` : 'All positive 🎉',
      subGood: negMonths === 0 ? true : negMonths > monthly.length / 2 ? false : undefined,
      icon: <CalendarDays size={14} />,
      iconColor: posMonths >= monthly.length * 0.7 ? 'var(--success)' : 'var(--destructive)',
      iconBg: posMonths >= monthly.length * 0.7
        ? 'color-mix(in srgb, var(--success) 12%, var(--background))'
        : 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
    },
  ];

  return (
    <div style={{ minHeight: hideNav ? undefined : '100vh', background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>

      {/* ── Top nav ────────────────────────────────────────────────────────── */}
      {!hideNav && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ padding: isMobile ? '0 1rem' : '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              {onBack && (
                <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--muted)', color: 'var(--foreground)', cursor: 'pointer', flexShrink: 0 }}>
                  <ArrowLeft size={14} />
                </button>
              )}
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Annual Report</span>
            </div>
            <YearPicker years={availableYears} selected={selectedYear} onChange={setSelectedYear} layoutId={yearNavId} />
          </div>
        </div>
      )}

      {/* ── Sub-nav (embedded) ─────────────────────────────────────────────── */}
      {hideNav && (
        <div style={{ position: 'sticky', top: 52, zIndex: 19, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0.5rem 1rem' : '0.5rem 1.5rem', height: 44, gap: '0.75rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>Annual Report</span>
            <YearPicker years={availableYears} selected={selectedYear} onChange={setSelectedYear} layoutId={yearNavId} small />
          </div>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: isMobile ? '1.25rem 1rem 1.5rem' : '1.5rem 1.75rem' }}>

        {/* Period presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '1rem' }}>
          {PERIOD_PRESETS.map(p => (
            <button key={p.value} onClick={() => { setPeriodPreset(p.value); if (p.value === 'custom') setCustomMonths(activeMonths); }}
              style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'var(--font-sans)', borderColor: periodPreset === p.value ? 'var(--foreground)' : 'var(--border)', background: periodPreset === p.value ? 'var(--foreground)' : 'transparent', color: periodPreset === p.value ? 'var(--background)' : 'var(--muted-foreground)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {periodPreset === 'custom' && (
          <div style={{ marginBottom: '1rem' }}>
            <MonthChips selected={customMonths} onChange={setCustomMonths} />
          </div>
        )}

        {/* Income headline */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {selectedYear} · {periodLabel} — Total income
            {yearRecurringTotal > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--color-orange-400)' }}>
                · {fmtEur(yearRecurringTotal)} recurring included in expenses
              </span>
            )}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: isMobile ? '1.9rem' : '2.4rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--foreground)', lineHeight: 1 }}>
              {fmtEur(kpis.income, 2)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {/* FIX: balance pill now reflects income - expenses - invested */}
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: kpis.balance >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
                {kpis.balance >= 0 ? '+' : ''}{fmtEur(kpis.balance, 2)} cash left
              </span>
              {/* FIX: two distinct rates — "non-expense" rate and invest rate */}
              <span title="% of income not spent on living expenses (investments included)" style={{ fontSize: '0.88rem', fontWeight: 700, color: kpis.savRate >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
                {kpis.savRate.toFixed(1)}% saved+invested
              </span>
              {kpis.investRate > 0 && (
                <span title="% of income allocated to investments" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-purple-600)' }}>
                  {kpis.investRate.toFixed(1)}% invested
                </span>
              )}
              {kpis.yoyInc !== null && <YoyBadge label="income"   value={kpis.yoyInc} positiveIsGood />}
              {kpis.yoyExp !== null && <YoyBadge label="expenses" value={kpis.yoyExp} positiveIsGood={false} />}
            </div>
          </div>
        </div>

        <StatPillRow pills={statPills} isMobile={isMobile} />
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <div style={{ padding: isMobile ? '1.25rem 1rem' : '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* ── Cash Flow ──────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<BarChart2 size={14} />} title="Cash Flow" subtitle="Monthly income vs expenses and running balance" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>

            <Card
              title="Income vs Expenses"
              subtitle="Recurring included in expenses"
              icon={<TrendingUp size={13} />}
              legend={<>
                <LegendDot color="var(--success)"     label="Income"   value={kpis.income} />
                <LegendDot color="var(--destructive)" label="Expenses" value={kpis.expenses} />
              </>}
            >
              {monthly.length === 0 ? <ChartEmptyState height={200} /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.14} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={tickFmt} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="income"   name="Income"   stroke="#16a34a" strokeWidth={2} fill="url(#gInc)" dot={false} activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#gExp)" dot={false} activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card
              title="Cumulative Net Balance"
              subtitle="Running total (income − expenses − investments)"
              icon={<TrendingUp size={13} />}
              legend={<LegendDot color={kpis.balance >= 0 ? '#2563eb' : '#ef4444'} label={`Final: ${kpis.balance >= 0 ? '+' : ''}${fmtEur(kpis.balance, 2)}`} />}
            >
              {cumulative.length === 0 ? <ChartEmptyState height={200} /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={cumulative} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={tickFmt} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="cumulative" name="Net" stroke={kpis.balance >= 0 ? '#2563eb' : '#ef4444'} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </section>

        {/* ── Spending Breakdown ─────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<BarChart2 size={14} />} title="Spending Breakdown" subtitle="Categories including recurring expenses" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '1.25rem' }}>

            <Card title="By category" subtitle="Recurring merged" icon={<BarChart2 size={13} />}>
              {catBreakdown.length === 0 ? <ChartEmptyState height={200} message="No expense data for this period" /> : (
                <>
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="amount" animationDuration={600}>
                          {catBreakdown.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                        </Pie>
                        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '0.9rem', fontWeight: 800, fill: 'var(--foreground)' }}>{fmtEur(kpis.expenses)}</text>
                        <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '0.6rem', fill: 'var(--muted-foreground)' }}>total</text>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {catBreakdown.map((c, i) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, background: 'var(--accent)', transition: 'background 0.12s', cursor: 'default' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontSize: '0.77rem', fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.icon} {c.name}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                          <p style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{fmtEur(c.amount)}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: 0 }}>{c.pct.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/*
              FIX: stacked bar now uses `txExpenses` (transaction-only living expenses)
              + `recurring` + `invested` — all with the same stackId="a".
              Previously `expenses` (= txExpenses + recurring) and `recurring` were both
              plotted, double-counting recurring amounts.
              Legend values are also corrected accordingly.
            */}
            <Card
              title="Monthly expenses + investments"
              subtitle="Stacked: living expenses · recurring · invested"
              icon={<BarChart2 size={13} />}
              legend={<>
                <LegendDot color="#fca5a5" label="Expenses"  value={kpis.expenses - yearRecurringTotal} square />
                <LegendDot color="var(--color-orange-400)" label="Recurring" value={yearRecurringTotal} square />
                <LegendDot color="#c4b9e0" label="Invested"  value={kpis.invested} square />
              </>}
            >
              {monthly.length === 0 ? <ChartEmptyState height={isMobile ? 220 : 340} /> : (
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 340}>
                  <BarChart data={monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="24%">
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={tickFmt} />
                    <Tooltip content={<ChartTooltip />} />
                    {/* FIX: all three bars share stackId="a" — no separate stack for recurring */}
                    <Bar dataKey="txExpenses" name="Expenses"  stackId="a" fill="#fca5a5" isAnimationActive />
                    <Bar dataKey="recurring"  name="Recurring" stackId="a" fill="#f9ae77" isAnimationActive />
                    <Bar dataKey="invested"   name="Invested"  stackId="a" fill="#c4b9e0" radius={[5,5,0,0]} isAnimationActive />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </section>

        {/* ── Insights ───────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<Sparkles size={14} />} title="Insights" subtitle="Monthly performance and year at a glance" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>

            <Card title="Monthly net — ranking" subtitle="Best vs worst and full breakdown" icon={<CalendarDays size={13} />}>
              {monthly.length === 0 ? <ChartEmptyState height={200} message="No data for this period" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                    {([
                      { label: '🏆 Best month',  m: bestMonth,  good: true },
                      { label: '📉 Worst month', m: worstMonth, good: (worstMonth?.net ?? 0) >= 0 },
                    ] as const).map(({ label, m, good }) => (
                      <div key={label} style={{ padding: '10px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', background: good ? 'color-mix(in srgb, var(--success) 8%, var(--background))' : 'color-mix(in srgb, var(--destructive) 8%, var(--background))', border: `1px solid ${good ? 'color-mix(in srgb, var(--success) 18%, transparent)' : 'color-mix(in srgb, var(--destructive) 18%, transparent)'}` }}>
                        <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 3px', fontWeight: 500 }}>{label}</p>
                        <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px' }}>{m?.label ?? '—'}</p>
                        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: good ? 'var(--success)' : 'var(--destructive)', margin: 0 }}>
                          {(m?.net ?? 0) >= 0 ? '+' : ''}{fmtEur(m?.net ?? 0, 2)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {monthly.map(m => {
                    const maxAbs = Math.max(...monthly.map(x => Math.abs(x.net)), 1);
                    return (
                      <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', width: 26, flexShrink: 0, fontWeight: 600 }}>{m.label}</span>
                        <div style={{ flex: 1, background: 'var(--muted)', borderRadius: 999, height: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 999, width: `${(Math.abs(m.net) / maxAbs) * 100}%`, background: m.net >= 0 ? 'var(--success)' : 'var(--destructive)', transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: m.net >= 0 ? 'var(--success)' : 'var(--destructive)', width: 62, textAlign: 'right', flexShrink: 0 }}>
                          {m.net >= 0 ? '+' : ''}{fmtEur(m.net)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Year at a glance" subtitle="Key metrics for the period" icon={<Sparkles size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

                {/* Streak — FIX: streak now computed over activeMonths only */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: 12, background: streak > 0 ? 'color-mix(in srgb, var(--color-orange-400) 8%, var(--background))' : 'var(--accent)', border: `1px solid ${streak > 0 ? 'color-mix(in srgb, var(--color-orange-400) 20%, transparent)' : 'var(--border)'}` }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 500 }}>Savings streak</p>
                    <p style={{ fontSize: '0.88rem', fontWeight: 700, color: streak > 0 ? 'var(--color-orange-400)' : 'var(--muted-foreground)', margin: 0 }}>
                      {streak > 0 ? `${streak} consecutive positive ${streak === 1 ? 'month' : 'months'}` : 'No current streak'}
                    </p>
                  </div>
                  <div style={{ fontSize: '1.6rem' }}>{streak > 0 ? '🔥' : '❄️'}</div>
                </div>

                {/* Pos/neg months */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Profitable months', value: posMonths, total: monthly.length, color: 'var(--success)',     bg: 'color-mix(in srgb, var(--success) 10%, var(--background))' },
                    { label: 'Deficit months',    value: negMonths, total: monthly.length, color: 'var(--destructive)', bg: 'color-mix(in srgb, var(--destructive) 10%, var(--background))' },
                  ].map(({ label, value, total, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: 12, padding: '0.75rem 1rem' }}>
                      <p style={{ fontSize: '0.63rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 2px' }}>{label}</p>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.04em' }}>
                        {value}<span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted-foreground)', marginLeft: 3 }}>/ {total}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Avg monthly */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: 12, background: 'var(--accent)', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 500 }}>Average monthly net</p>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: avgMonthly >= 0 ? 'var(--success)' : 'var(--destructive)', margin: 0, letterSpacing: '-0.025em' }}>
                      {avgMonthly >= 0 ? '+' : ''}{fmtEur(avgMonthly, 2)}
                    </p>
                  </div>
                  <ArrowUpRight size={18} style={{ color: avgMonthly >= 0 ? 'var(--success)' : 'var(--destructive)', transform: avgMonthly < 0 ? 'rotate(90deg)' : 'none' }} />
                </div>

                {/* Investment bar */}
                {kpis.invested > 0 && (
                  <div style={{ padding: '0.85rem 1rem', borderRadius: 12, background: 'color-mix(in srgb, var(--color-purple-600) 8%, var(--background))', border: '1px solid color-mix(in srgb, var(--color-purple-600) 20%, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: 0, fontWeight: 500 }}>Investment allocation</p>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-purple-600)', margin: 0 }}>{fmtEur(kpis.invested)}</p>
                    </div>
                    <div style={{ background: 'var(--muted)', borderRadius: 999, height: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((kpis.invested / kpis.income) * 100, 100)}%`, background: 'var(--color-purple-600)', borderRadius: 999, transition: 'width 0.5s ease' }} />
                    </div>
                    <p style={{ fontSize: '0.63rem', color: 'var(--color-purple-600)', fontWeight: 600, margin: '5px 0 0' }}>
                      {kpis.income > 0 ? `${kpis.investRate.toFixed(1)}% of income invested` : '—'}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </section>

        {/* ── Year-over-Year ─────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<GitCompare size={14} />} title="Year-over-Year" subtitle={`Comparing ${periodLabel} — same period across years`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.85rem 1.1rem' }}>
              <div>
                <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Years (max 5)</p>
                <YearChips years={availableYears} selected={compareYears} onChange={setCompareYears} max={5} />
              </div>
              <div style={{ flexShrink: 0 }}>
                <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</p>
                <MetricToggle />
              </div>
            </div>

            <Card
              title="Monthly comparison"
              subtitle="Side by side per month"
              icon={<BarChart2 size={13} />}
              legend={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {compareYears.map((y, i) => {
                  const total = compareData.reduce((s, d) => s + (d[String(y)] ?? 0), 0);
                  return <LegendDot key={y} color={YEAR_COLORS[i % YEAR_COLORS.length]} label={`${y}`} value={total} />;
                })}
              </div>}
            >
              {compareData.length === 0 ? <ChartEmptyState height={230} /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={compareData} barCategoryGap="20%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={tickFmt} />
                    <Tooltip content={<ChartTooltip />} />
                    {compareYears.map((y, i) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[4,4,0,0]} isAnimationActive />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card
              title="Cumulative net — trajectory"
              subtitle="Running balance per year"
              icon={<TrendingUp size={13} />}
            >
              {cumCompareData.length === 0 ? <ChartEmptyState height={210} /> : (
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={cumCompareData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={tickFmt} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                    {compareYears.map((y, i) => (
                      <Line key={y} type="monotone" dataKey={String(y)} name={String(y)} stroke={YEAR_COLORS[i % YEAR_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </section>

        {/* ── Month Comparison ───────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<CalendarDays size={14} />} title="Month Comparison" subtitle="Same months across different years" />
          <Card title="Expenses per month across years">
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Months</p>
                <MonthChips selected={compareMonths} onChange={setCompareMonths} />
              </div>
              <div>
                <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Years (max 5)</p>
                <YearChips years={availableYears} selected={compareMonthYears} onChange={setCompareMonthYears} max={5} />
              </div>
            </div>

            {monthCompareData.length === 0 ? <ChartEmptyState height={200} /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthCompareData} barCategoryGap="24%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={tickFmt} />
                  <Tooltip content={<ChartTooltip />} />
                  {compareMonths.map((m, i) => (
                    <Bar key={m} dataKey={MONTH_LABELS[m]} name={`${MONTH_LABELS[m]} expenses`} fill={CAT_COLORS[i % CAT_COLORS.length]} radius={[4,4,0,0]} isAnimationActive />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Summary table */}
            <div style={{ marginTop: '1rem', overflowX: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    {['Year', ...compareMonths.map(m => MONTH_LABELS[m]), 'Total'].map((h, i) => (
                      <th key={h + i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '5px 10px', color: 'var(--muted-foreground)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareMonthYears.map((y, yi) => {
                    const rowTotal = compareMonths.reduce((s, m) => {
                      const txAmt  = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); }).reduce((ss, t) => ss + t.amount, 0);
                      const recAmt = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
                      return s + txAmt + recAmt;
                    }, 0);
                    return (
                      <tr key={y} style={{ background: yi % 2 === 0 ? 'transparent' : 'var(--accent)' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: YEAR_COLORS[yi % YEAR_COLORS.length], fontSize: '0.8rem' }}>{y}</td>
                        {compareMonths.map(m => {
                          const txAmt  = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); }).reduce((s, t) => s + t.amount, 0);
                          const recAmt = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
                          const val    = txAmt + recAmt;
                          return (
                            <td key={m} style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--foreground)', fontWeight: 500 }}>
                              {val > 0 ? fmtEur(val, 2) : <span style={{ color: 'var(--muted-foreground)' }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--foreground)' }}>{fmtEur(rowTotal, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

      </div>
    </div>
  );
};

export default YearlyStats;
