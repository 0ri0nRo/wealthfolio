// src/pages/budget/YearlyStats.tsx
import { BudgetTransaction } from '@/lib/types/budget';
import {
    ArrowLeft, BarChart2, CalendarDays, Flame, GitCompare, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
    Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const isInvestment = (t: BudgetTransaction) => {
  if (!t.category) return false;
  const n = t.category.name.toLowerCase();
  return n.includes('invest') || n.includes('crypto') || n.includes('etf') || n.includes('stock');
};

const fmtEur = (n: number, dec = 0) =>
  `€${n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLORS = ['#f9ae77', '#87d3c3', '#c4b9e0', '#bec97e', '#92bfdb', '#f4a4c2', '#f89a8a', '#f6e2a0'];
const YEAR_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#d97706'];

function useIsMobile(bp = 768) {
  const [is, setIs] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setIs(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return is;
}

const GlassTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass" style={{ borderRadius: 10, padding: '9px 13px', fontSize: 12, minWidth: 140 }}>
      {label && <p style={{ color: 'var(--muted-foreground)', marginBottom: 4, fontWeight: 500 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? 'var(--foreground)', margin: '2px 0', fontWeight: 600 }}>
          {p.name}: €{typeof p.value === 'number' ? p.value.toLocaleString('en-US', { minimumFractionDigits: 0 }) : p.value}
        </p>
      ))}
    </div>
  );
};

const Card: React.FC<{
  title: string; subtitle?: string; children: React.ReactNode;
  icon?: React.ReactNode; style?: React.CSSProperties; action?: React.ReactNode;
}> = ({ title, subtitle, children, icon, style, action }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', ...style }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ color: 'var(--muted-foreground)' }}>{icon}</span>}
        <div>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '2px 0 0', fontWeight: 500 }}>{subtitle}</p>}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0, marginLeft: 8 }}>{action}</div>}
    </div>
    {children}
  </div>
);

const ToggleGroup: React.FC<{ options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 10, padding: 3 }}>
    {options.map((o) => (
      <button key={o.value} onClick={() => onChange(o.value)} style={{
        padding: '4px 11px', fontSize: '0.75rem', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
        background: value === o.value ? 'var(--card)' : 'transparent',
        color: value === o.value ? 'var(--foreground)' : 'var(--muted-foreground)',
        boxShadow: value === o.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
      }}>{o.label}</button>
    ))}
  </div>
);

const MonthChips: React.FC<{ selected: number[]; onChange: (v: number[]) => void }> = ({ selected, onChange }) => {
  const toggle = (m: number) => {
    if (selected.includes(m)) { if (selected.length === 1) return; onChange(selected.filter((x) => x !== m)); }
    else onChange([...selected, m].sort((a, b) => a - b));
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {MONTH_LABELS.map((label, i) => (
        <button key={i} onClick={() => toggle(i)} style={{
          padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
          borderColor: selected.includes(i) ? 'var(--foreground)' : 'var(--border)',
          background: selected.includes(i) ? 'var(--foreground)' : 'transparent',
          color: selected.includes(i) ? 'var(--background)' : 'var(--muted-foreground)',
        }}>{label}</button>
      ))}
      {selected.length < 12 && (
        <button onClick={() => onChange(MONTH_LABELS.map((_, i) => i))} style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: '1px dashed var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--muted-foreground)' }}>All</button>
      )}
    </div>
  );
};

const YearChips: React.FC<{ years: number[]; selected: number[]; onChange: (v: number[]) => void; max?: number }> = ({ years, selected, onChange, max = 5 }) => {
  const toggle = (y: number) => {
    if (selected.includes(y)) { if (selected.length === 1) return; onChange(selected.filter((x) => x !== y)); }
    else { if (selected.length >= max) return; onChange([...selected, y].sort((a, b) => a - b)); }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {years.map((y, i) => {
        const color = YEAR_COLORS[i % YEAR_COLORS.length];
        const sel = selected.includes(y);
        return (
          <button key={y} onClick={() => toggle(y)} style={{
            padding: '3px 12px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 999, border: '1.5px solid', cursor: 'pointer', transition: 'all 0.12s',
            borderColor: sel ? color : 'var(--border)',
            background: sel ? `color-mix(in srgb, ${color} 15%, var(--background))` : 'transparent',
            color: sel ? color : 'var(--muted-foreground)',
          }}>{y}</button>
        );
      })}
    </div>
  );
};

type PeriodPreset = 'full' | 'h1' | 'h2' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom';
const PERIOD_PRESETS: { value: PeriodPreset; label: string; months: number[] }[] = [
  { value: 'full', label: 'Full year', months: [0,1,2,3,4,5,6,7,8,9,10,11] },
  { value: 'h1',   label: 'H1',        months: [0,1,2,3,4,5] },
  { value: 'h2',   label: 'H2',        months: [6,7,8,9,10,11] },
  { value: 'q1',   label: 'Q1',        months: [0,1,2] },
  { value: 'q2',   label: 'Q2',        months: [3,4,5] },
  { value: 'q3',   label: 'Q3',        months: [6,7,8] },
  { value: 'q4',   label: 'Q4',        months: [9,10,11] },
  { value: 'custom', label: 'Custom ✏️', months: [] },
];

type ViewMode = 'single' | 'compare';
type CompareMetric = 'expenses' | 'income' | 'net';

interface YearlyStatsProps {
  allTransactions: BudgetTransaction[];
  onBack?: () => void;
}

export const YearlyStats: React.FC<YearlyStatsProps> = ({ allTransactions, onBack }) => {
  const isMobile = useIsMobile();

  const availableYears = useMemo(() => {
    const years = new Set(allTransactions.map((t) => new Date(t.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [allTransactions]);

  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [selectedYear, setSelectedYear] = useState(availableYears.includes(currentYear) ? currentYear : (availableYears[0] ?? currentYear));
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('full');
  const [customMonths, setCustomMonths] = useState<number[]>([0,1,2,3,4,5,6,7,8,9,10,11]);
  const [compareYears, setCompareYears] = useState<number[]>(() => availableYears.slice(0, Math.min(2, availableYears.length)));
  const [compareMetric, setCompareMetric] = useState<CompareMetric>('expenses');
  const [compareMonths, setCompareMonths] = useState<number[]>([new Date().getMonth()]);
  const [compareMonthYears, setCompareMonthYears] = useState<number[]>(() => availableYears.slice(0, Math.min(2, availableYears.length)));

  const activeMonths = useMemo(() => {
    if (periodPreset === 'custom') return customMonths;
    return PERIOD_PRESETS.find((p) => p.value === periodPreset)?.months ?? [0,1,2,3,4,5,6,7,8,9,10,11];
  }, [periodPreset, customMonths]);

  const yearTx = useMemo(() =>
    allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === selectedYear && activeMonths.includes(d.getMonth()); }),
    [allTransactions, selectedYear, activeMonths]
  );

  const prevYearTx = useMemo(() =>
    allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === selectedYear - 1 && activeMonths.includes(d.getMonth()); }),
    [allTransactions, selectedYear, activeMonths]
  );

  const kpis = useMemo(() => {
    const income   = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = yearTx.filter((t) => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    const invested = yearTx.filter((t) => isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    const balance  = income - expenses;
    const savRate  = income > 0 ? ((income - expenses) / income) * 100 : 0;
    const prevExp  = prevYearTx.filter((t) => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    const yoy      = prevExp > 0 ? ((expenses - prevExp) / prevExp) * 100 : null;
    return { income, expenses, invested, balance, savRate, yoy };
  }, [yearTx, prevYearTx]);

  const monthly = useMemo(() =>
    MONTH_LABELS.map((label, m) => {
      if (!activeMonths.includes(m)) return null;
      const mx = allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === selectedYear && d.getMonth() === m; });
      const income   = mx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = mx.filter((t) => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      const invested = mx.filter((t) => isInvestment(t)).reduce((s, t) => s + t.amount, 0);
      return { label, income, expenses, invested, net: income - expenses };
    }).filter(Boolean) as { label: string; income: number; expenses: number; invested: number; net: number }[],
    [allTransactions, selectedYear, activeMonths]
  );

  const cumulative = useMemo(() => { let r = 0; return monthly.map((m) => { r += m.net; return { label: m.label, cumulative: r }; }); }, [monthly]);

  const catBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; amount: number; count: number }>();
    yearTx.filter((t) => t.type === 'expense' && !isInvestment(t)).forEach((t) => {
      if (!t.category) return;
      const k = String(t.category.id);
      const ex = map.get(k);
      if (ex) { ex.amount += t.amount; ex.count++; }
      else map.set(k, { name: t.category.name, icon: t.category.icon ?? '📦', amount: t.amount, count: 1 });
    });
    const total = [...map.values()].reduce((s, c) => s + c.amount, 0);
    return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 8)
      .map((c, i) => ({ ...c, pct: total > 0 ? (c.amount / total) * 100 : 0, color: COLORS[i % COLORS.length] }));
  }, [yearTx]);

  const bestMonth  = monthly.length ? monthly.reduce((a, b) => b.net > a.net ? b : a) : null;
  const worstMonth = monthly.length ? monthly.reduce((a, b) => b.net < a.net ? b : a) : null;

  const streak = useMemo(() => {
    const nets = MONTH_LABELS.map((_, m) => {
      const mx = allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === selectedYear && d.getMonth() === m; });
      return mx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) - mx.filter((t) => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
    });
    let s = 0; for (let i = nets.length - 1; i >= 0; i--) { if (nets[i] > 0) s++; else break; }
    return s;
  }, [allTransactions, selectedYear]);

  const compareData = useMemo(() =>
    MONTH_LABELS.map((label, m) => {
      const row: Record<string, any> = { label };
      compareYears.forEach((y) => {
        const mx = allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; });
        const inc = mx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const exp = mx.filter((t) => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
        row[String(y)] = Math.round(compareMetric === 'income' ? inc : compareMetric === 'net' ? inc - exp : exp);
      });
      return row;
    }),
    [allTransactions, compareYears, compareMetric]
  );

  const monthCompareData = useMemo(() =>
    compareMonthYears.map((y) => {
      const row: Record<string, any> = { label: String(y) };
      compareMonths.forEach((m) => {
        const mx = allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); });
        row[MONTH_LABELS[m]] = Math.round(mx.reduce((s, t) => s + t.amount, 0));
      });
      return row;
    }),
    [allTransactions, compareMonths, compareMonthYears]
  );

  const axisTick = { fontSize: 10, fill: 'var(--muted-foreground)' } as any;
  const tickFmt = (v: number) => `€${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>

      {/* NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '0 1rem' : '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            {onBack && (
              <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--muted)', color: 'var(--foreground)', cursor: 'pointer', flexShrink: 0 }}>
                <ArrowLeft size={14} />
              </button>
            )}
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', flexShrink: 0 }}>Annual Report</span>
            {!isMobile && (
              <ToggleGroup
                options={[{ value: 'single', label: '📊 Analysis' }, { value: 'compare', label: '⚖️ Compare' }]}
                value={viewMode} onChange={(v) => setViewMode(v as ViewMode)}
              />
            )}
          </div>
          {viewMode === 'single' && (
            <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 10, padding: 3, flexShrink: 0 }}>
              {availableYears.map((y) => (
                <button key={y} onClick={() => setSelectedYear(y)} style={{ padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: selectedYear === y ? 'var(--card)' : 'transparent', color: selectedYear === y ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: selectedYear === y ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{y}</button>
              ))}
            </div>
          )}
        </div>
        {isMobile && (
          <div style={{ padding: '0 1rem 0.6rem', display: 'flex', justifyContent: 'center' }}>
            <ToggleGroup options={[{ value: 'single', label: '📊 Analysis' }, { value: 'compare', label: '⚖️ Compare' }]} value={viewMode} onChange={(v) => setViewMode(v as ViewMode)} />
          </div>
        )}
      </div>

      {/* ════════ SINGLE ANALYSIS ════════ */}
      {viewMode === 'single' && (
        <>
          {/* Hero */}
          <div style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${kpis.balance >= 0 ? '#16a34a' : '#dc2626'} 8%, var(--background)) 0%, var(--background) 70%)`, borderBottom: '1px solid var(--border)' }}>
            {/* Period selector */}
            <div style={{ padding: '1rem 1.75rem 0', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {PERIOD_PRESETS.map((p) => (
                <button key={p.value} onClick={() => { setPeriodPreset(p.value); if (p.value === 'custom') setCustomMonths(activeMonths); }} style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s', borderColor: periodPreset === p.value ? 'var(--foreground)' : 'var(--border)', background: periodPreset === p.value ? 'var(--foreground)' : 'transparent', color: periodPreset === p.value ? 'var(--background)' : 'var(--muted-foreground)' }}>{p.label}</button>
              ))}
            </div>
            {periodPreset === 'custom' && (
              <div style={{ padding: '0.6rem 1.75rem 0' }}>
                <MonthChips selected={customMonths} onChange={setCustomMonths} />
              </div>
            )}
            <div style={{ padding: '1rem 1.75rem 0' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {selectedYear} · {PERIOD_PRESETS.find((p) => p.value === periodPreset)?.label ?? 'Custom'} — Income
              </p>
              <p style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--foreground)', margin: '0 0 0.35rem', lineHeight: 1 }}>{fmtEur(kpis.income, 2)}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: kpis.balance >= 0 ? '#16a34a' : '#dc2626' }}>{kpis.balance >= 0 ? '+' : ''}{fmtEur(kpis.balance, 2)} net</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: kpis.savRate >= 0 ? '#16a34a' : '#dc2626' }}>{kpis.savRate.toFixed(1)}% savings rate</span>
                {kpis.yoy !== null && <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>vs {selectedYear - 1}: expenses {kpis.yoy > 0 ? '▲' : '▼'} {Math.abs(kpis.yoy).toFixed(1)}%</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', margin: '0 1.75rem 1.25rem', borderRadius: 14, overflow: 'hidden' }}>
              {[
                { label: 'Total Expenses', value: fmtEur(kpis.expenses), icon: <TrendingDown size={13} />, color: '#dc2626', bg: 'color-mix(in srgb, #dc2626 10%, var(--background))' },
                { label: 'Total Invested',  value: fmtEur(kpis.invested), icon: <TrendingUp size={13} />,  color: '#7c3aed', bg: 'color-mix(in srgb, #7c3aed 10%, var(--background))' },
                { label: 'Net Balance',     value: fmtEur(kpis.balance),  icon: <Wallet size={13} />, color: kpis.balance >= 0 ? '#2563eb' : '#dc2626', bg: kpis.balance >= 0 ? 'color-mix(in srgb, #2563eb 10%, var(--background))' : 'color-mix(in srgb, #dc2626 10%, var(--background))' },
                { label: 'Savings Streak', value: `${streak} months 🔥`, icon: <Flame size={13} />, color: streak > 0 ? '#f97316' : 'var(--muted-foreground)', bg: streak > 0 ? 'color-mix(in srgb, #f97316 10%, var(--background))' : 'var(--muted)' },
              ].map(({ label, value, icon, color, bg }) => (
                <div key={label} style={{ background: 'var(--card)', padding: isMobile ? '0.85rem 0.9rem' : '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '0.66rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                    <p style={{ fontSize: isMobile ? '0.88rem' : '1rem', fontWeight: 700, color, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
                  </div>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '1rem' : '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
              <Card title="Monthly Cash Flow" subtitle="Income vs Expenses" icon={<BarChart2 size={14} />}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                    <Tooltip content={<GlassTooltip />} />
                    <Area type="monotone" dataKey="income"   name="Income"   stroke="#16a34a" strokeWidth={2} fill="url(#gInc)" dot={false} activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#gExp)" dot={false} activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Cumulative Net Balance" subtitle="Running total" icon={<TrendingUp size={14} />}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cumulative} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={50} tickFormatter={tickFmt} />
                    <Tooltip content={<GlassTooltip />} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="cumulative" name="Net" stroke={kpis.balance >= 0 ? '#2563eb' : '#ef4444'} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '1.25rem' }}>
              <Card title="Expenses by Category" subtitle="Period breakdown" icon={<BarChart2 size={14} />}>
                {catBreakdown.length > 0 ? (
                  <>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="amount" animationDuration={700}>
                            {catBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '0.9rem', fontWeight: 700, fill: 'var(--foreground)' }}>{fmtEur(kpis.expenses)}</text>
                          <Tooltip content={<GlassTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                      {catBreakdown.map((c) => (
                        <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 9px', borderRadius: 8, background: 'var(--accent)', cursor: 'default' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.icon} {c.name}</span>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{fmtEur(c.amount)}</p>
                            <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: 0 }}>{c.pct.toFixed(1)}%</p>
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

              <Card title="Monthly Expenses + Investments" subtitle="Stacked by type" icon={<BarChart2 size={14} />}>
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 400}>
                  <BarChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barCategoryGap="24%">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                    <Tooltip content={<GlassTooltip />} />
                    <Bar dataKey="expenses" name="Expenses" stackId="a" fill="#fca5a5" />
                    <Bar dataKey="invested"  name="Invested"  stackId="a" fill="#c4b9e0" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
              <Card title="Peak Months" subtitle="Best vs Worst net balance" icon={<CalendarDays size={14} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([{ label: '🏆 Best month', m: bestMonth, positive: true }, { label: '📉 Worst month', m: worstMonth, positive: (worstMonth?.net ?? 0) >= 0 }] as const).map(({ label, m, positive }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: positive ? 'color-mix(in srgb, #16a34a 8%, var(--background))' : 'color-mix(in srgb, #dc2626 8%, var(--background))', border: `1px solid ${positive ? 'color-mix(in srgb, #16a34a 20%, transparent)' : 'color-mix(in srgb, #dc2626 20%, transparent)'}` }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '0 0 3px', fontWeight: 500 }}>{label}</p>
                        <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{m?.label ?? '—'}</p>
                      </div>
                      <p style={{ fontSize: '1rem', fontWeight: 700, color: positive ? '#16a34a' : '#dc2626', margin: 0 }}>{(m?.net ?? 0) >= 0 ? '+' : ''}{fmtEur(m?.net ?? 0, 2)}</p>
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    {monthly.map((m) => {
                      const maxAbs = Math.max(...monthly.map((x) => Math.abs(x.net)), 1);
                      return (
                        <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', width: 26, flexShrink: 0 }}>{m.label}</span>
                          <div style={{ flex: 1, background: 'var(--muted)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 999, width: `${(Math.abs(m.net) / maxAbs) * 100}%`, background: m.net >= 0 ? '#16a34a' : '#ef4444', transition: 'width 0.5s ease' }} />
                          </div>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: m.net >= 0 ? '#16a34a' : '#dc2626', width: 56, textAlign: 'right', flexShrink: 0 }}>{m.net >= 0 ? '+' : ''}{fmtEur(m.net)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card title="Savings Streak 🔥" subtitle="Consecutive profitable months" icon={<Flame size={14} />}>
                <div style={{ textAlign: 'center', padding: '0.5rem 0 0.75rem' }}>
                  <div style={{ fontSize: '3rem', lineHeight: 1, marginBottom: '0.4rem', filter: streak > 0 ? 'drop-shadow(0 0 12px rgba(249,115,22,0.4))' : 'none' }}>{streak > 0 ? '🔥' : '❄️'}</div>
                  <p style={{ fontSize: '2.8rem', fontWeight: 900, color: streak > 0 ? '#f97316' : '#6366f1', margin: '0 0 4px', letterSpacing: '-0.05em' }}>{streak}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', margin: 0 }}>{streak === 1 ? 'month in a row' : 'months in a row'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: '1rem' }}>
                    {[
                      { label: 'Positive months', value: monthly.filter((m) => m.net > 0).length, color: '#16a34a', bg: 'color-mix(in srgb, #16a34a 10%, var(--background))' },
                      { label: 'Negative months', value: monthly.filter((m) => m.net < 0).length, color: '#dc2626', bg: 'color-mix(in srgb, #dc2626 10%, var(--background))' },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} style={{ background: bg, borderRadius: 12, padding: '0.65rem 1rem' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 2px' }}>{label}</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: 0 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ════════ COMPARE VIEW ════════ */}
      {viewMode === 'compare' && (
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '1rem' : '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Year-over-Year */}
          <Card title="Year-over-Year" subtitle="Compare multiple years month by month" icon={<GitCompare size={14} />} action={
            <ToggleGroup options={[{ value: 'expenses', label: 'Expenses' }, { value: 'income', label: 'Income' }, { value: 'net', label: 'Net' }]} value={compareMetric} onChange={(v) => setCompareMetric(v as CompareMetric)} />
          }>
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '0.4rem' }}>Select years (max 5):</p>
              <YearChips years={availableYears} selected={compareYears} onChange={setCompareYears} max={5} />
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={compareData} barCategoryGap="20%" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                <Tooltip content={<GlassTooltip />} />
                {compareYears.map((y, i) => <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {compareYears.map((y, i) => {
                const total = compareData.reduce((s, d) => s + (d[String(y)] ?? 0), 0);
                return (
                  <div key={y} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{y} · <strong style={{ color: 'var(--foreground)' }}>{fmtEur(total)}</strong></span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Cumulative lines */}
          <Card title="Cumulative Net — Year Comparison" subtitle="Running balance trajectory" icon={<TrendingUp size={14} />}>
            <div style={{ marginBottom: '0.75rem' }}>
              <YearChips years={availableYears} selected={compareYears} onChange={setCompareYears} max={5} />
            </div>
            {(() => {
              const cumData = MONTH_LABELS.map((label, m) => {
                const row: Record<string, any> = { label };
                compareYears.forEach((y) => {
                  const running = MONTH_LABELS.slice(0, m + 1).reduce((acc, _, mm) => {
                    const mx = allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === mm; });
                    return acc + mx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) - mx.filter((t) => t.type === 'expense' && !isInvestment(t)).reduce((s, t) => s + t.amount, 0);
                  }, 0);
                  row[String(y)] = Math.round(running);
                });
                return row;
              });
              return (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={cumData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={50} tickFormatter={tickFmt} />
                    <Tooltip content={<GlassTooltip />} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                    {compareYears.map((y, i) => <Line key={y} type="monotone" dataKey={String(y)} name={String(y)} stroke={YEAR_COLORS[i % YEAR_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />)}
                  </LineChart>
                </ResponsiveContainer>
              );
            })()}
          </Card>

          {/* Month-vs-Month */}
          <Card title="Month Comparison" subtitle="Specific months across different years" icon={<CalendarDays size={14} />}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '0.4rem' }}>Months:</p>
                <MonthChips selected={compareMonths} onChange={setCompareMonths} />
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '0.4rem' }}>Years (max 5):</p>
                <YearChips years={availableYears} selected={compareMonthYears} onChange={setCompareMonthYears} max={5} />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthCompareData} barCategoryGap="24%" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} tickFormatter={tickFmt} />
                <Tooltip content={<GlassTooltip />} />
                {compareMonths.map((m, i) => <Bar key={m} dataKey={MONTH_LABELS[m]} name={`${MONTH_LABELS[m]} expenses`} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
            {/* Detail table */}
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--muted-foreground)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Year</th>
                    {compareMonths.map((m) => <th key={m} style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--muted-foreground)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{MONTH_LABELS[m]}</th>)}
                    <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--muted-foreground)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {compareMonthYears.map((y, yi) => {
                    const rowTotal = compareMonths.reduce((s, m) => s + allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); }).reduce((ss, t) => ss + t.amount, 0), 0);
                    return (
                      <tr key={y} style={{ background: yi % 2 === 0 ? 'transparent' : 'var(--accent)' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: YEAR_COLORS[yi % YEAR_COLORS.length] }}>{y}</td>
                        {compareMonths.map((m) => {
                          const val = allTransactions.filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && !isInvestment(t); }).reduce((s, t) => s + t.amount, 0);
                          return <td key={m} style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--foreground)', fontWeight: 500 }}>{val > 0 ? fmtEur(val, 2) : <span style={{ color: 'var(--muted-foreground)' }}>—</span>}</td>;
                        })}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--foreground)' }}>{fmtEur(rowTotal, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}
    </div>
  );
};

export default YearlyStats;
