// src/pages/budget/components/YearlyStats.tsx
import { BudgetTransaction } from '@/lib/types/budget';
import { RecurringExpense, RecurringExpenseEntry, isRecurringActiveInMonth } from '@/lib/types/recurring';
import {
  ArrowLeft, ArrowUpRight, BarChart2, CalendarDays,
  Flame, GitCompare, Sparkles, TrendingDown, TrendingUp, Wallet,
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
const CAT_COLORS   = ['#f9ae77','#87d3c3','#c4b9e0','#bec97e','#92bfdb','#f4a4c2','#f89a8a','#f6e2a0'];
const YEAR_COLORS  = ['#2563eb','#16a34a','#dc2626','#7c3aed','#d97706'];

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
function getRecurringAmountForMonth(
  rwe: RecurringWithEntries,
  year: number,
  month: number
): number {
  const entry = rwe.entries.find(e => e.year === year && e.month === month);
  if (entry) return entry.amount;
  if (isRecurringActiveInMonth(rwe.recurringExpense, year, month)) {
    return rwe.recurringExpense.amount;
  }
  return 0;
}

function getTotalRecurringForMonth(
  allRec: RecurringWithEntries[],
  year: number,
  month: number
): number {
  return allRec.reduce((s, rwe) => s + getRecurringAmountForMonth(rwe, year, month), 0);
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const GlassTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass" style={{ borderRadius: 10, padding: '9px 13px', fontSize: 12, minWidth: 140 }}>
      {label && <p style={{ color: 'var(--muted-foreground)', marginBottom: 4, fontWeight: 600, fontSize: 11 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? 'var(--foreground)', margin: '2px 0', fontWeight: 700 }}>
          {p.name}: {typeof p.value === 'number'
            ? `€${p.value.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : p.value}
        </p>
      ))}
    </div>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
    <div>
      <h2 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.015em' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>{subtitle}</p>}
    </div>
  </div>
);

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; style?: React.CSSProperties }> = ({ title, subtitle, children, icon, action, style }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden', ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>{icon}</div>}
        <div>
          <h3 style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
    <div style={{ padding: '1rem 1.25rem' }}>{children}</div>
  </div>
);

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

const YoyBadge: React.FC<{ label: string; value: number; positiveIsGood: boolean }> = ({ label, value, positiveIsGood }) => {
  const isGood = positiveIsGood ? value > 0 : value < 0;
  const color  = isGood ? '#16a34a' : '#dc2626';
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `color-mix(in srgb, ${color} 10%, var(--background))`, color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
      {label} {value > 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
};

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
  { value: 'full',   label: 'Full year', months: [0,1,2,3,4,5,6,7,8,9,10,11] },
  { value: 'h1',     label: 'H1',        months: [0,1,2,3,4,5] },
  { value: 'h2',     label: 'H2',        months: [6,7,8,9,10,11] },
  { value: 'q1',     label: 'Q1',        months: [0,1,2] },
  { value: 'q2',     label: 'Q2',        months: [3,4,5] },
  { value: 'q3',     label: 'Q3',        months: [6,7,8] },
  { value: 'q4',     label: 'Q4',        months: [9,10,11] },
  { value: 'custom', label: 'Custom',    months: [] },
];

type CompareMetric = 'expenses' | 'income' | 'net';

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
      const startYear = new Date(rwe.recurringExpense.startDate).getFullYear();
      s.add(startYear);
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
    activeMonths.reduce((s, m) =>
      s + getTotalRecurringForMonth(allRecurringEntries, selectedYear, m + 1), 0),
    [allRecurringEntries, selectedYear, activeMonths]);

  const prevYearRecurringTotal = useMemo(() =>
    activeMonths.reduce((s, m) =>
      s + getTotalRecurringForMonth(allRecurringEntries, selectedYear - 1, m + 1), 0),
    [allRecurringEntries, selectedYear, activeMonths]);

  const kpis = useMemo(() => {
    const income       = yearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const txExpenses   = yearTx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    const expenses     = txExpenses + yearRecurringTotal;
    const invested     = yearTx.filter(t => isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    const balance      = income - expenses;
    const savRate      = income > 0 ? ((income - expenses) / income) * 100 : 0;
    const prevInc      = prevYearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevTxExp    = prevYearTx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    const prevExp      = prevTxExp + prevYearRecurringTotal;
    const yoyInc       = prevInc  > 0 ? ((income   - prevInc)  / prevInc)  * 100 : null;
    const yoyExp       = prevExp  > 0 ? ((expenses - prevExp)  / prevExp)  * 100 : null;
    return { income, expenses, invested, balance, savRate, yoyInc, yoyExp };
  }, [yearTx, prevYearTx, yearRecurringTotal, prevYearRecurringTotal]);

  const monthly = useMemo(() =>
    MONTH_LABELS.map((label, m) => {
      if (!activeMonths.includes(m)) return null;
      const mx       = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === selectedYear && d.getMonth() === m; });
      const income   = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const txExp    = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      const recExp   = getTotalRecurringForMonth(allRecurringEntries, selectedYear, m + 1);
      const expenses = txExp + recExp;
      const invested = mx.filter(t => isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      return { label, income, expenses, invested, net: income - expenses, recurring: recExp };
    }).filter(Boolean) as { label: string; income: number; expenses: number; invested: number; net: number; recurring: number }[],
    [allTransactions, allRecurringEntries, selectedYear, activeMonths]);

  const cumulative = useMemo(() => {
    let r = 0;
    return monthly.map(m => { r += m.net; return { label: m.label, cumulative: r }; });
  }, [monthly]);

  // ── categories ────────────────────────────────────────────────────────────
  // FIX: recurring expenses are now merged into their category (by categoryId),
  // same as manual transactions — no more separate "Rent", "Housing" entries.
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; amount: number; count: number }>();

    // 1. Manual transactions (no investments)
    yearTx.filter(t => t.type === 'expense' && !isInvestment(t)).forEach(t => {
      if (!t.category) return;
      const k = String(t.category.id);
      const ex = map.get(k);
      if (ex) { ex.amount += t.amount; ex.count++; }
      else map.set(k, { name: t.category.name, icon: t.category.icon ?? '📦', amount: t.amount, count: 1 });
    });

    // 2. Recurring entries — grouped by categoryId (same key as manual transactions)
    //    so they merge correctly into the same category bucket.
    allRecurringEntries.forEach(rwe => {
      const amount = activeMonths.reduce((s, m) =>
        s + getRecurringAmountForMonth(rwe, selectedYear, m + 1), 0);
      if (amount <= 0) return;

      const catId = String(rwe.recurringExpense.categoryId);
      const ex = map.get(catId);
      if (ex) {
        // Category already exists from manual tx → just add the amount
        ex.amount += amount;
        ex.count++;
      } else {
        // Category only has recurring entries → create a new bucket.
        // We don't have the full category object here, so we fall back to
        // the recurring expense description as the display name.
        // If you have access to a categories array here you could look it up.
        map.set(catId, {
          name:  rwe.recurringExpense.description,
          icon:  '🔁',
          amount,
          count: 1,
        });
      }
    });

    const total = [...map.values()].reduce((s, c) => s + c.amount, 0);
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((c, i) => ({ ...c, pct: total > 0 ? (c.amount / total) * 100 : 0, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [yearTx, allRecurringEntries, selectedYear, activeMonths]);

  const streak = useMemo(() => {
    const nets = MONTH_LABELS.map((_, m) => {
      const mx = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === selectedYear && d.getMonth() === m; });
      const income = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const txExp  = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      const recExp = getTotalRecurringForMonth(allRecurringEntries, selectedYear, m + 1);
      return income - txExp - recExp;
    });
    let s = 0;
    for (let i = nets.length - 1; i >= 0; i--) { if (nets[i] > 0) s++; else break; }
    return s;
  }, [allTransactions, allRecurringEntries, selectedYear]);

  const bestMonth  = monthly.length ? monthly.reduce((a, b) => b.net > a.net ? b : a) : null;
  const worstMonth = monthly.length ? monthly.reduce((a, b) => b.net < a.net ? b : a) : null;
  const posMonths  = monthly.filter(m => m.net > 0).length;
  const negMonths  = monthly.filter(m => m.net < 0).length;
  const avgMonthly = monthly.length ? monthly.reduce((s, m) => s + m.net, 0) / monthly.length : 0;

  const compareData = useMemo(() =>
    MONTH_LABELS.map((label, m) => {
      const row: Record<string, any> = { label };
      compareYears.forEach(y => {
        const mx    = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; });
        const inc   = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const txExp = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
        const recExp = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
        const exp   = txExp + recExp;
        row[String(y)] = Math.round(compareMetric === 'income' ? inc : compareMetric === 'net' ? inc - exp : exp);
      });
      return row;
    }),
    [allTransactions, allRecurringEntries, compareYears, compareMetric]);

  const monthCompareData = useMemo(() =>
    compareMonthYears.map(y => {
      const row: Record<string, any> = { label: String(y) };
      compareMonths.forEach(m => {
        const mx    = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); });
        const txAmt = mx.reduce((s, t) => s + t.amount, 0);
        const recAmt = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
        row[MONTH_LABELS[m]] = Math.round(txAmt + recAmt);
      });
      return row;
    }),
    [allTransactions, allRecurringEntries, compareMonths, compareMonthYears]);

  const cumCompareData = useMemo(() =>
    MONTH_LABELS.map((label, m) => {
      const row: Record<string, any> = { label };
      compareYears.forEach(y => {
        const running = MONTH_LABELS.slice(0, m + 1).reduce((acc, _, mm) => {
          const mx = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === mm; });
          const inc    = mx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const txExp  = mx.filter(t => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
          const recExp = getTotalRecurringForMonth(allRecurringEntries, y, mm + 1);
          return acc + inc - txExp - recExp;
        }, 0);
        row[String(y)] = Math.round(running);
      });
      return row;
    }),
    [allTransactions, allRecurringEntries, compareYears]);

  const axisTick = { fontSize: 10, fill: 'var(--muted-foreground)' } as any;
  const tickFmt  = (v: number) => `€${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;

  const periodLabel = periodPreset === 'custom'
    ? activeMonths.length === 12 ? 'Full year' : `${MONTH_LABELS[activeMonths[0]]}–${MONTH_LABELS[activeMonths[activeMonths.length - 1]]}`
    : PERIOD_PRESETS.find(p => p.value === periodPreset)?.label ?? '';

  const MetricToggle = () => (
    <div style={{ display: 'inline-flex', background: 'var(--muted)', borderRadius: 999, padding: 3, gap: 2 }}>
      {(['expenses','income','net'] as CompareMetric[]).map(m => (
        <button key={m} onClick={() => setCompareMetric(m)} style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', background: compareMetric === m ? 'var(--background)' : 'transparent', color: compareMetric === m ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: compareMetric === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: hideNav ? undefined : '100vh', background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>

      {!hideNav && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 90%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '0 1rem' : '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              {onBack && <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--muted)', color: 'var(--foreground)', cursor: 'pointer', flexShrink: 0 }}><ArrowLeft size={14} /></button>}
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.025em' }}>Annual Report</span>
            </div>
            <YearPicker years={availableYears} selected={selectedYear} onChange={setSelectedYear} layoutId={yearNavId} />
          </div>
        </div>
      )}

      {hideNav && (
        <div style={{ position: 'sticky', top: 52, zIndex: 19, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0.5rem 1rem' : '0.5rem 1.5rem', height: 44, gap: '0.75rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>Annual Report</span>
            <YearPicker years={availableYears} selected={selectedYear} onChange={setSelectedYear} layoutId={yearNavId} small />
          </div>
        </div>
      )}

      {/* HERO */}
      <div style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${kpis.balance >= 0 ? '#16a34a' : '#dc2626'} 6%, var(--background)) 0%, var(--background) 100%)`, borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: isMobile ? '1rem 1rem 0' : '1.25rem 1.75rem 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PERIOD_PRESETS.map(p => (
            <button key={p.value} onClick={() => { setPeriodPreset(p.value); if (p.value === 'custom') setCustomMonths(activeMonths); }} style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.12s', borderColor: periodPreset === p.value ? 'var(--foreground)' : 'var(--border)', background: periodPreset === p.value ? 'var(--foreground)' : 'transparent', color: periodPreset === p.value ? 'var(--background)' : 'var(--muted-foreground)' }}>{p.label}</button>
          ))}
        </div>
        {periodPreset === 'custom' && (
          <div style={{ padding: isMobile ? '0.6rem 1rem 0' : '0.6rem 1.75rem 0' }}>
            <MonthChips selected={customMonths} onChange={setCustomMonths} />
          </div>
        )}

        <div style={{ padding: isMobile ? '1rem 1rem 0' : '1.25rem 1.75rem 0' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '0 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {selectedYear} · {periodLabel} — Income
            {yearRecurringTotal > 0 && <span style={{ marginLeft: 8, color: 'var(--color-orange-400)' }}>· includes {fmtEur(yearRecurringTotal)} recurring</span>}
          </p>
          <p style={{ fontSize: isMobile ? '2rem' : '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--foreground)', margin: '0 0 0.4rem', lineHeight: 1 }}>
            {fmtEur(kpis.income, 2)}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: kpis.balance >= 0 ? '#16a34a' : '#dc2626' }}>
              {kpis.balance >= 0 ? '+' : ''}{fmtEur(kpis.balance, 2)} net
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: kpis.savRate >= 0 ? '#16a34a' : '#dc2626' }}>
              {kpis.savRate.toFixed(1)}% savings rate
            </span>
            {kpis.yoyInc !== null && <YoyBadge label="income"   value={kpis.yoyInc} positiveIsGood />}
            {kpis.yoyExp !== null && <YoyBadge label="expenses" value={kpis.yoyExp} positiveIsGood={false} />}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)', margin: isMobile ? '0 1rem 1.25rem' : '0 1.75rem 1.5rem', borderRadius: 14, overflow: 'hidden' }}>
          {[
            { label: 'Expenses',        value: fmtEur(kpis.expenses), sub: kpis.yoyExp !== null ? `${kpis.yoyExp > 0 ? '+' : ''}${kpis.yoyExp.toFixed(1)}% YoY` : undefined, subPos: kpis.yoyExp !== null ? kpis.yoyExp < 0 : undefined, icon: <TrendingDown size={13} />, color: '#dc2626', bg: 'color-mix(in srgb, #dc2626 10%, var(--background))' },
            { label: 'Invested',        value: fmtEur(kpis.invested), sub: kpis.invested > 0 ? `${((kpis.invested / kpis.income) * 100).toFixed(1)}% of income` : undefined, icon: <TrendingUp size={13} />, color: '#7c3aed', bg: 'color-mix(in srgb, #7c3aed 10%, var(--background))' },
            { label: 'Net Balance',     value: fmtEur(kpis.balance), sub: `avg ${fmtCompact(Math.round(avgMonthly))}/mo`, icon: <Wallet size={13} />, color: kpis.balance >= 0 ? '#2563eb' : '#dc2626', bg: kpis.balance >= 0 ? 'color-mix(in srgb, #2563eb 10%, var(--background))' : 'color-mix(in srgb, #dc2626 10%, var(--background))' },
            { label: 'Positive months', value: `${posMonths} / ${monthly.length}`, sub: negMonths > 0 ? `${negMonths} negative` : 'All positive 🎉', subPos: negMonths === 0, icon: <CalendarDays size={13} />, color: posMonths >= monthly.length * 0.7 ? '#16a34a' : '#dc2626', bg: posMonths >= monthly.length * 0.7 ? 'color-mix(in srgb, #16a34a 10%, var(--background))' : 'color-mix(in srgb, #dc2626 10%, var(--background))' },
            { label: 'Saving streak 🔥', value: `${streak} months`, sub: streak > 0 ? 'consecutive positive' : 'No current streak', subPos: streak > 0, icon: <Flame size={13} />, color: streak > 0 ? '#f97316' : 'var(--muted-foreground)', bg: streak > 0 ? 'color-mix(in srgb, #f97316 10%, var(--background))' : 'var(--muted)' },
          ].map(({ label, value, sub, subPos, icon, color, bg }, idx) => (
            <div key={label} style={{ background: 'var(--card)', padding: isMobile ? '0.85rem 1rem' : '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, ...(isMobile && idx === 4 ? { gridColumn: 'span 2' } : {}) }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.63rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                <p style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
                {sub && <p style={{ fontSize: '0.63rem', fontWeight: 600, color: subPos === true ? '#16a34a' : subPos === false ? '#dc2626' : 'var(--muted-foreground)', margin: '2px 0 0' }}>{sub}</p>}
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '1.25rem 1rem' : '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* Cash Flow */}
        <section>
          <SectionHeader icon={<BarChart2 size={14} />} title="Cash Flow" subtitle="Monthly income, expenses (incl. recurring) and running balance" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
            <Card title="Monthly Income vs Expenses" subtitle="Recurring included" icon={<TrendingUp size={13} />}>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.2} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                  <Tooltip content={<GlassTooltip />} />
                  <Area type="monotone" dataKey="income"   name="Income"   stroke="#16a34a" strokeWidth={2} fill="url(#gInc)" dot={false} activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#gExp)" dot={false} activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
              <LegendRow items={[{ color: '#16a34a', label: 'Income', value: kpis.income }, { color: '#ef4444', label: 'Expenses (all)', value: kpis.expenses }]} />
            </Card>

            <Card title="Cumulative Net Balance" subtitle="Running total" icon={<TrendingUp size={13} />}>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={cumulative} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={tickFmt} />
                  <Tooltip content={<GlassTooltip />} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="cumulative" name="Net" stroke={kpis.balance >= 0 ? '#2563eb' : '#ef4444'} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ paddingTop: '0.5rem', fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', gap: 6 }}>
                Final balance: <strong style={{ color: kpis.balance >= 0 ? '#16a34a' : '#dc2626' }}>{kpis.balance >= 0 ? '+' : ''}{fmtEur(kpis.balance, 2)}</strong>
              </div>
            </Card>
          </div>
        </section>

        {/* Spending Breakdown */}
        <section>
          <SectionHeader icon={<BarChart2 size={14} />} title="Spending Breakdown" subtitle="Categories including recurring expenses" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '1.25rem' }}>
            <Card title="Expenses by Category" subtitle="Recurring merged by category" icon={<BarChart2 size={13} />}>
              {catBreakdown.length > 0 ? (
                <>
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="amount" animationDuration={700}>
                          {catBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '0.92rem', fontWeight: 800, fill: 'var(--foreground)' }}>{fmtEur(kpis.expenses)}</text>
                        <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '0.62rem', fill: 'var(--muted-foreground)' }}>total</text>
                        <Tooltip content={<GlassTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {catBreakdown.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, background: 'var(--accent)', transition: 'background 0.12s', cursor: 'default' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.77rem', fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.icon} {c.name}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                          <p style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{fmtEur(c.amount)}</p>
                          <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: 0 }}>{c.pct.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                  <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }}>💸</span>No expense data for this period
                </div>
              )}
            </Card>

            <Card title="Monthly Expenses + Investments" subtitle="Stacked by type" icon={<BarChart2 size={13} />}>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 380}>
                <BarChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                  <Tooltip content={<GlassTooltip />} />
                  <Bar dataKey="expenses"  name="Expenses (all)" stackId="a" fill="#fca5a5" />
                  <Bar dataKey="recurring" name="of which recurring" stackId="b" fill="#f9ae77" radius={[0,0,0,0]} />
                  <Bar dataKey="invested"  name="Invested"          stackId="a" fill="#c4b9e0" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <LegendRow items={[{ color: '#fca5a5', label: 'Total expenses', value: kpis.expenses, square: true }, { color: '#f9ae77', label: 'Recurring', value: yearRecurringTotal, square: true }, { color: '#c4b9e0', label: 'Invested', value: kpis.invested, square: true }]} />
            </Card>
          </div>
        </section>

        {/* Insights */}
        <section>
          <SectionHeader icon={<Sparkles size={14} />} title="Insights" subtitle="Monthly performance and year at a glance" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
            <Card title="Monthly Net — Breakdown" subtitle="Best vs worst and full ranking" icon={<CalendarDays size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                  {([
                    { label: '🏆 Best month',  m: bestMonth,  positive: true },
                    { label: '📉 Worst month', m: worstMonth, positive: (worstMonth?.net ?? 0) >= 0 },
                  ] as const).map(({ label, m, positive }) => (
                    <div key={label} style={{ padding: '10px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', background: positive ? 'color-mix(in srgb, #16a34a 8%, var(--background))' : 'color-mix(in srgb, #dc2626 8%, var(--background))', border: `1px solid ${positive ? 'color-mix(in srgb, #16a34a 20%, transparent)' : 'color-mix(in srgb, #dc2626 20%, transparent)'}` }}>
                      <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '0 0 4px', fontWeight: 500 }}>{label}</p>
                      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px' }}>{m?.label ?? '—'}</p>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: positive ? '#16a34a' : '#dc2626', margin: 0 }}>
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
                      <div style={{ flex: 1, background: 'var(--muted)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${(Math.abs(m.net) / maxAbs) * 100}%`, background: m.net >= 0 ? '#16a34a' : '#ef4444', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: m.net >= 0 ? '#16a34a' : '#dc2626', width: 60, textAlign: 'right', flexShrink: 0 }}>
                        {m.net >= 0 ? '+' : ''}{fmtEur(m.net)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Year at a Glance" subtitle="Key metrics for the period" icon={<Sparkles size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1rem', borderRadius: 12, background: streak > 0 ? 'color-mix(in srgb, #f97316 8%, var(--background))' : 'var(--accent)', border: `1px solid ${streak > 0 ? 'color-mix(in srgb, #f97316 20%, transparent)' : 'var(--border)'}` }}>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 500 }}>Savings streak 🔥</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: streak > 0 ? '#f97316' : 'var(--muted-foreground)', margin: 0 }}>
                      {streak > 0 ? `${streak} consecutive positive ${streak === 1 ? 'month' : 'months'}` : 'No current streak'}
                    </p>
                  </div>
                  <span style={{ fontSize: '1.75rem', filter: streak > 0 ? 'drop-shadow(0 0 8px rgba(249,115,22,0.5))' : 'none' }}>{streak > 0 ? '🔥' : '❄️'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Profitable months', value: posMonths, total: monthly.length, color: '#16a34a', bg: 'color-mix(in srgb, #16a34a 10%, var(--background))' },
                    { label: 'Deficit months',     value: negMonths, total: monthly.length, color: '#dc2626', bg: 'color-mix(in srgb, #dc2626 10%, var(--background))' },
                  ].map(({ label, value, total, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: 12, padding: '0.75rem 1rem' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 2px' }}>{label}</p>
                      <p style={{ fontSize: '1.6rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.04em' }}>
                        {value}<span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-foreground)', marginLeft: 3 }}>/ {total}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: 12, background: 'var(--accent)', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 500 }}>Average monthly net</p>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: avgMonthly >= 0 ? '#16a34a' : '#dc2626', margin: 0, letterSpacing: '-0.025em' }}>
                      {avgMonthly >= 0 ? '+' : ''}{fmtEur(avgMonthly, 2)}
                    </p>
                  </div>
                  <ArrowUpRight size={18} style={{ color: avgMonthly >= 0 ? '#16a34a' : '#dc2626', transform: avgMonthly < 0 ? 'rotate(90deg)' : 'none' }} />
                </div>
                {kpis.invested > 0 && (
                  <div style={{ padding: '0.85rem 1rem', borderRadius: 12, background: 'color-mix(in srgb, #7c3aed 8%, var(--background))', border: '1px solid color-mix(in srgb, #7c3aed 20%, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: 0, fontWeight: 500 }}>Investment allocation</p>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed', margin: 0 }}>{fmtEur(kpis.invested)}</p>
                    </div>
                    <div style={{ background: 'var(--muted)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((kpis.invested / kpis.income) * 100, 100)}%`, background: 'linear-gradient(90deg, #c4b9e0, #7c3aed)', borderRadius: 999, transition: 'width 0.5s ease' }} />
                    </div>
                    <p style={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 600, margin: '5px 0 0' }}>
                      {kpis.income > 0 ? `${((kpis.invested / kpis.income) * 100).toFixed(1)}% of income invested` : '—'}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </section>

        {/* Year-over-Year */}
        <section>
          <SectionHeader icon={<GitCompare size={14} />} title="Year-over-Year" subtitle="Compare multiple years side by side (recurring included)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.85rem 1.1rem' }}>
              <div>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select years (max 5)</p>
                <YearChips years={availableYears} selected={compareYears} onChange={setCompareYears} max={5} />
              </div>
              <div style={{ flexShrink: 0 }}>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</p>
                <MetricToggle />
              </div>
            </div>

            <Card title="Monthly Comparison" subtitle="Side by side per month" icon={<BarChart2 size={13} />}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={compareData} barCategoryGap="20%" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                  <Tooltip content={<GlassTooltip />} />
                  {compareYears.map((y, i) => <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[4, 4, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.75rem' }}>
                {compareYears.map((y, i) => {
                  const total = compareData.reduce((s, d) => s + (d[String(y)] ?? 0), 0);
                  const color = YEAR_COLORS[i % YEAR_COLORS.length];
                  return (
                    <div key={y} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: `color-mix(in srgb, ${color} 10%, var(--background))`, border: `1.5px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{y} · <strong style={{ color }}>{fmtEur(total)}</strong></span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Cumulative Net — Trajectory" subtitle="Running balance per year" icon={<TrendingUp size={13} />}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={cumCompareData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={tickFmt} />
                  <Tooltip content={<GlassTooltip />} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                  {compareYears.map((y, i) => (
                    <Line key={y} type="monotone" dataKey={String(y)} name={String(y)} stroke={YEAR_COLORS[i % YEAR_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </section>

        {/* Month Comparison */}
        <section>
          <SectionHeader icon={<CalendarDays size={14} />} title="Month Comparison" subtitle="Same months across different years" />
          <Card title="Expenses per month across years">
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Months</p>
                <MonthChips selected={compareMonths} onChange={setCompareMonths} />
              </div>
              <div>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 600, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Years (max 5)</p>
                <YearChips years={availableYears} selected={compareMonthYears} onChange={setCompareMonthYears} max={5} />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthCompareData} barCategoryGap="24%" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                <Tooltip content={<GlassTooltip />} />
                {compareMonths.map((m, i) => (
                  <Bar key={m} dataKey={MONTH_LABELS[m]} name={`${MONTH_LABELS[m]} expenses`} fill={CAT_COLORS[i % CAT_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    {['Year', ...compareMonths.map(m => MONTH_LABELS[m]), 'Total'].map((h, i) => (
                      <th key={h + i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 10px', color: 'var(--muted-foreground)', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareMonthYears.map((y, yi) => {
                    const rowTotal = compareMonths.reduce((s, m) => {
                      const txAmt = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); }).reduce((ss, t) => ss + t.amount, 0);
                      const recAmt = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
                      return s + txAmt + recAmt;
                    }, 0);
                    return (
                      <tr key={y} style={{ background: yi % 2 === 0 ? 'transparent' : 'var(--accent)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: YEAR_COLORS[yi % YEAR_COLORS.length], fontSize: '0.82rem' }}>{y}</td>
                        {compareMonths.map(m => {
                          const txAmt = allTransactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); }).reduce((s, t) => s + t.amount, 0);
                          const recAmt = getTotalRecurringForMonth(allRecurringEntries, y, m + 1);
                          const val = txAmt + recAmt;
                          return <td key={m} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--foreground)', fontWeight: 500 }}>{val > 0 ? fmtEur(val, 2) : <span style={{ color: 'var(--muted-foreground)' }}>—</span>}</td>;
                        })}
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--foreground)' }}>{fmtEur(rowTotal, 2)}</td>
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

const LegendRow: React.FC<{ items: { color: string; label: string; value: number; square?: boolean }[] }> = ({ items }) => (
  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
    {items.map(({ color, label, value, square }) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: square ? 2 : '50%', background: color }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
          {label} · <strong style={{ color: 'var(--foreground)' }}>{fmtEur(value)}</strong>
        </span>
      </div>
    ))}
  </div>
);

export default YearlyStats;
