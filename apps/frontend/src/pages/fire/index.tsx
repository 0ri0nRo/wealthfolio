// src/pages/fire/index.tsx
import { FireSettings, useFire } from '@/hooks/useFire';
import { Activity, Flame, Settings, Shield, Target, TrendingUp, X, Zap } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

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

const fmtEur = (n: number) =>
  n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `€${(n / 1_000).toFixed(1)}k`
  : `€${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

const fmtMonths = (m: number) => {
  if (m >= 9990) return '∞';
  if (m >= 120) return `${(m / 12).toFixed(1)}y`;
  return `${Math.round(m)}m`;
};

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}
function fmtDateLabel(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
}

// ── Settings Modal ────────────────────────────────────────────────────────────
const SettingsModal: React.FC<{
  initial: FireSettings;
  onSave: (s: FireSettings) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}> = ({ initial, onSave, onClose, saving }) => {
  const [form, setForm] = useState<FireSettings>({ ...initial });
  const set = (k: keyof FireSettings, v: any) => setForm(f => ({ ...f, [k]: v }));

  const numInput = (
    label: string,
    field: keyof FireSettings,
    opts?: { prefix?: string; step?: number; hint?: string; placeholder?: string; pct?: boolean }
  ) => {
    const { prefix = '€', step = 50, hint, placeholder, pct } = opts ?? {};
    const rawVal = form[field] as number | null;
    const displayVal = pct && rawVal != null ? (rawVal * 100).toFixed(1) : (rawVal ?? '');
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </label>
        {hint && <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '-0.2rem 0 0.4rem' }}>{hint}</p>}
        <div style={{ position: 'relative' }}>
          {prefix && <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 600 }}>{prefix}</span>}
          <input
            type="number" step={step} value={displayVal} placeholder={placeholder}
            onChange={e => {
              if (e.target.value === '') { set(field, null); return; }
              const v = parseFloat(e.target.value);
              set(field, pct ? v / 100 : v);
            }}
            style={{ width: '100%', padding: prefix ? '0.65rem 0.75rem 0.65rem 1.75rem' : '0.65rem 0.75rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' as const }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Settings size={16} color="var(--muted-foreground)" />
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>FIRE Settings</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: '0 0 1.25rem', fontStyle: 'italic' }}>
            These parameters are saved and used for all FIRE calculations.
          </p>
          {numInput('Monthly target spending', 'monthly_expenses', { hint: 'Base for Runway and FIRE Number' })}
          {numInput('Monthly net income', 'monthly_income_override', { hint: 'Overrides the budget average if set' })}
          {numInput('INPS unemployment benefit', 'inps_monthly', { hint: 'Monthly INPS amount for the "With INPS" scenario' })}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              FIRE Number (optional)
            </label>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '-0.2rem 0 0.4rem' }}>
              If empty, auto-calculated: expenses × 12 × 25 (4% rule)
            </p>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 600 }}>€</span>
              <input type="number" step={5000} value={form.fire_number ?? ''} placeholder={`Auto: ${fmtEur((form.monthly_expenses || 2000) * 12 * 25)}`}
                onChange={e => set('fire_number', e.target.value === '' ? null : parseFloat(e.target.value))}
                style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 1.75rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {numInput('Annual return %', 'annual_return_rate', { prefix: '', step: 0.5, pct: true })}
            {numInput('Inflation %', 'inflation_rate', { prefix: '', step: 0.5, pct: true })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
            {numInput('Current age', 'current_age', { prefix: '', step: 1, placeholder: '—' })}
            {numInput('Target FIRE age', 'target_fire_age', { prefix: '', step: 1, placeholder: '—' })}
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1.25rem', background: 'var(--muted)', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
          <button onClick={() => onSave(form).then(onClose)} disabled={saving}
            style={{ padding: '0.6rem 1.5rem', background: 'var(--foreground)', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--background)', fontFamily: 'var(--font-sans)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Freedom Score Ring ────────────────────────────────────────────────────────
const FreedomRing: React.FC<{ score: number; isMobile: boolean }> = ({ score, isMobile }) => {
  const size = isMobile ? 140 : 180;
  const stroke = 10;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score < 25 ? '#ef4444' : score < 50 ? '#f97316' : score < 75 ? '#eab308' : '#22c55e';
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: isMobile ? '1.8rem' : '2.2rem', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{Math.round(score)}</span>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Freedom</span>
      </div>
    </div>
  );
};

// ── Runway Bar ────────────────────────────────────────────────────────────────
const RunwayBar: React.FC<{ scenario: { label: string; months: number; description: string }; maxMonths: number; index: number }> = ({ scenario, maxMonths, index }) => {
  const colors = ['#3b82f6', '#f59e0b', '#22c55e'];
  const color = colors[index % colors.length];
  const isInfinite = scenario.months >= 9990;
  const pct = isInfinite ? 100 : Math.min((scenario.months / maxMonths) * 100, 100);
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>{scenario.label}</span>
        <span style={{ fontSize: '1rem', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{isInfinite ? '∞' : fmtMonths(scenario.months)}</span>
      </div>
      <div style={{ background: 'var(--muted)', borderRadius: '999px', height: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', width: `${pct}%`, background: color, transition: 'width 1s ease' }} />
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '0.25rem 0 0' }}>{scenario.description}</p>
    </div>
  );
};

// ── Time To Broke Chart ───────────────────────────────────────────────────────
interface TtbPoint { month: number; date: Date; capital: number; withReturns: number; }

const TimeToBrokeChart: React.FC<{ netWorth: number; monthlyExpenses: number; annualReturn: number; isMobile: boolean }> = ({ netWorth, monthlyExpenses, annualReturn, isMobile }) => {
  const pts = useMemo<TtbPoint[]>(() => {
    const monthlyReturn = annualReturn / 12;
    const MAX_MONTHS = 480;
    const result: TtbPoint[] = [];
    let capital = netWorth;
    let capitalWithReturns = netWorth;
    const start = new Date();
    for (let m = 0; m <= MAX_MONTHS; m++) {
      result.push({ month: m, date: addMonths(start, m), capital: Math.max(capital, 0), withReturns: Math.max(capitalWithReturns, 0) });
      if (capital <= 0 && capitalWithReturns <= 0) break;
      capital -= monthlyExpenses;
      capitalWithReturns = capitalWithReturns * (1 + monthlyReturn) - monthlyExpenses;
    }
    return result;
  }, [netWorth, monthlyExpenses, annualReturn]);

  const zeroCapital = pts.find(p => p.capital <= 0);
  const zeroReturns = pts.find(p => p.withReturns <= 0);
  const maxMonth = pts[pts.length - 1].month;
  const tickEvery = maxMonth <= 36 ? 6 : maxMonth <= 120 ? 12 : 24;
  const ticks = pts.filter(p => p.month % tickEvery === 0);

  const W = isMobile ? 340 : 560;
  const H = 200;
  const pad = { top: 16, bottom: 28, left: 52, right: 16 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const maxVal = netWorth;
  const scaleX = (m: number) => pad.left + (m / maxMonth) * chartW;
  const scaleY = (v: number) => pad.top + (1 - Math.min(v, maxVal) / maxVal) * chartH;

  const toPath = (key: 'capital' | 'withReturns') => {
    const filtered = pts.filter((p, i) => p[key] > 0 || i === 0);
    const lastPos = filtered[filtered.length - 1];
    const nextIdx = pts.indexOf(lastPos) + 1;
    const nextPt = nextIdx < pts.length ? pts[nextIdx] : null;
    const extra = nextPt ? ` L ${scaleX(nextPt.month)},${scaleY(0)}` : '';
    return filtered.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.month)},${scaleY(p[key])}`).join(' ') + extra;
  };

  const toArea = (key: 'capital' | 'withReturns') => {
    const path = toPath(key);
    const zeroX = key === 'capital'
      ? (zeroCapital ? scaleX(zeroCapital.month) : scaleX(maxMonth))
      : (zeroReturns ? scaleX(zeroReturns.month) : scaleX(maxMonth));
    return `${path} L ${zeroX},${scaleY(0)} L ${pad.left},${scaleY(0)} Z`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ val: maxVal * f, y: scaleY(maxVal * f) }));

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' as const }}>
        {[
          { color: '#ef4444', label: `Capital only → broke ${zeroCapital ? fmtDateLabel(zeroCapital.date) : '∞'}` },
          { color: '#22c55e', label: `With returns → broke ${zeroReturns ? fmtDateLabel(zeroReturns.date) : '∞'}` },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, background: color }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.12" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map(({ val, y }) => (
          <g key={val}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={pad.left - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">
              {val >= 1000 ? `€${(val / 1000).toFixed(0)}k` : `€${val}`}
            </text>
          </g>
        ))}
        <path d={toArea('capital')} fill="url(#gradRed)" />
        <path d={toArea('withReturns')} fill="url(#gradGreen)" />
        <path d={toPath('capital')} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath('withReturns')} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {zeroCapital && (
          <g>
            <line x1={scaleX(zeroCapital.month)} y1={pad.top} x2={scaleX(zeroCapital.month)} y2={scaleY(0)} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" />
            <circle cx={scaleX(zeroCapital.month)} cy={scaleY(0)} r={4} fill="#ef4444" />
            <text x={scaleX(zeroCapital.month)} y={pad.top - 2} textAnchor="middle" fontSize="8" fill="#ef4444" fontFamily="var(--font-sans)" fontWeight="700">{fmtDateLabel(zeroCapital.date)}</text>
          </g>
        )}
        {zeroReturns && (
          <g>
            <line x1={scaleX(zeroReturns.month)} y1={pad.top} x2={scaleX(zeroReturns.month)} y2={scaleY(0)} stroke="#22c55e" strokeWidth="1" strokeDasharray="4,3" />
            <circle cx={scaleX(zeroReturns.month)} cy={scaleY(0)} r={4} fill="#22c55e" />
            <text x={scaleX(zeroReturns.month)} y={pad.top - 2} textAnchor="middle" fontSize="8" fill="#22c55e" fontFamily="var(--font-sans)" fontWeight="700">{fmtDateLabel(zeroReturns.date)}</text>
          </g>
        )}
        {ticks.map(p => (
          <text key={p.month} x={scaleX(p.month)} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{fmtDateLabel(p.date)}</text>
        ))}
      </svg>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' as const }}>
        {[
          { label: 'Capital only', value: zeroCapital ? `${zeroCapital.month} months` : '∞', color: '#ef4444' },
          { label: 'With returns', value: zeroReturns ? `${zeroReturns.month} months` : '∞', color: '#22c55e' },
          { label: 'Extra runway', value: zeroCapital && zeroReturns ? `+${zeroReturns.month - zeroCapital.month} months` : '∞', color: '#7c3aed' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: `color-mix(in srgb, ${color} 10%, var(--background))`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`, borderRadius: '10px', padding: '0.5rem 0.85rem' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Net Worth Sparkline ───────────────────────────────────────────────────────
const NetWorthChart: React.FC<{ history: { date: string; total_value: number }[]; isMobile: boolean }> = ({ history, isMobile }) => {
  if (history.length < 2) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>
      Not enough data to display chart
    </div>
  );
  const W = isMobile ? 300 : 440;
  const H = 110;
  const pad = { top: 10, bottom: 22, left: 8, right: 8 };
  const values = history.map(p => p.total_value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = history.map((p, i) => {
    const x = pad.left + (i / (history.length - 1)) * (W - pad.left - pad.right);
    const y = pad.top + (1 - (p.total_value - min) / range) * (H - pad.top - pad.bottom);
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `${pathD} L ${W - pad.right},${H - pad.bottom} L ${pad.left},${H - pad.bottom} Z`;
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#22c55e' : '#ef4444';
  const labelIdxs = [0, Math.floor(history.length / 2), history.length - 1];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {(() => { const [lx, ly] = pts[pts.length - 1].split(',').map(Number); return <circle cx={lx} cy={ly} r={4} fill={color} />; })()}
      {labelIdxs.map(i => {
        const [lx] = pts[i].split(',').map(Number);
        const d = new Date(history[i].date);
        return <text key={i} x={lx} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{`${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`}</text>;
      })}
    </svg>
  );
};

// ── FIRE Scenario Card ────────────────────────────────────────────────────────
const FireScenarioCard: React.FC<{
  scenario: { label: string; monthly_target: number; fire_number: number; months_to_fire: number | null; years_to_fire: number | null };
  isMiddle?: boolean;
}> = ({ scenario, isMiddle }) => {
  const colors: Record<string, { bg: string; accent: string; icon: React.ReactNode }> = {
    'Lean FIRE': { bg: 'color-mix(in srgb, #3b82f6 10%, var(--background))', accent: '#3b82f6', icon: <Zap size={14} /> },
    'Regular FIRE': { bg: 'color-mix(in srgb, #f59e0b 10%, var(--background))', accent: '#f59e0b', icon: <Flame size={14} /> },
    'Fat FIRE': { bg: 'color-mix(in srgb, #22c55e 10%, var(--background))', accent: '#22c55e', icon: <Shield size={14} /> },
  };
  const c = colors[scenario.label] ?? colors['Regular FIRE'];
  return (
    <div style={{ background: 'var(--card)', border: isMiddle ? `2px solid ${c.accent}` : '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', boxShadow: isMiddle ? `0 4px 20px color-mix(in srgb, ${c.accent} 20%, transparent)` : '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: c.bg, color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>{scenario.label}</span>
        {isMiddle && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: c.bg, color: c.accent }}>Target</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Spending/mo</p>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>{fmtEur(scenario.monthly_target)}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>FIRE Number</p>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: c.accent, margin: 0, letterSpacing: '-0.02em' }}>{fmtEur(scenario.fire_number)}</p>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Time to FIRE</p>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, color: scenario.months_to_fire === 0 ? '#22c55e' : 'var(--foreground)', margin: 0, letterSpacing: '-0.03em' }}>
            {scenario.months_to_fire === null ? '—' : scenario.months_to_fire === 0 ? '🎉 Achieved!' : scenario.years_to_fire !== null ? `${scenario.years_to_fire.toFixed(1)} years` : '—'}
          </p>
          {scenario.months_to_fire !== null && scenario.months_to_fire > 0 && (
            <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>({Math.round(scenario.months_to_fire)} months)</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const FirePage: React.FC = () => {
  const { data, loading, error, saving, refresh, saveSettings } = useFire();
  const [showSettings, setShowSettings] = useState(false);
  const isMobile = useIsMobile();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid var(--foreground)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  if (error || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
      <div style={{ textAlign: 'center', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--destructive)', fontWeight: 600, marginBottom: 8 }}>Failed to load FIRE data</p>
        <p style={{ color: 'var(--muted-foreground)', marginBottom: 24 }}>{error}</p>
        <button onClick={refresh} style={{ padding: '8px 20px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );

  const settings = data.settings;
  const maxRunway = Math.max(...data.runway_scenarios.filter(s => s.months < 9990).map(s => s.months), 60);
  const isCoastFire = (() => {
    if (!settings.current_age || !settings.target_fire_age) return false;
    const years = settings.target_fire_age - settings.current_age;
    if (years <= 0) return false;
    const fireNum = settings.fire_number ?? data.avg_monthly_expenses * 12 * 25;
    return data.net_worth * Math.pow(1 + settings.annual_return_rate, years) >= fireNum;
  })();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', fontFamily: 'var(--font-sans)' }}>

      {/* NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 1rem' : '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Flame size={18} color="#f97316" />
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>FIRE Dashboard</span>
          </div>
          <button onClick={() => setShowSettings(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '7px 14px', background: 'var(--muted)', color: 'var(--foreground)', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            <Settings size={13} />
            {!isMobile && 'Settings'}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? `1.25rem 1rem calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` : '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* TOP: Freedom Ring + Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px 1fr', gap: '1.25rem' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <FreedomRing score={data.freedom_score} isMobile={isMobile} />
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.4rem' }}>
                <span>Net Worth</span><span>FIRE Target</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--foreground)' }}>{fmtEur(data.net_worth)}</span>
                <span style={{ color: 'var(--muted-foreground)' }}>{fmtEur(settings.fire_number ?? data.avg_monthly_expenses * 12 * 25)}</span>
              </div>
            </div>
            {isCoastFire && (
              <div style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', background: 'color-mix(in srgb, #22c55e 12%, var(--background))', border: '1px solid color-mix(in srgb, #22c55e 30%, transparent)', textAlign: 'center' as const }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#22c55e' }}>🏖️ Coast FIRE reached!</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {[
              { label: 'Avg income/mo', value: fmtEur(data.avg_monthly_income), icon: <TrendingUp size={13} />, color: '#16a34a' },
              { label: 'Target spending/mo', value: fmtEur(data.avg_monthly_expenses), icon: <Target size={13} />, color: '#f97316' },
              { label: 'Net savings/mo', value: fmtEur(data.avg_monthly_savings), icon: <Activity size={13} />, color: data.avg_monthly_savings >= 0 ? '#3b82f6' : '#ef4444' },
              { label: 'Savings rate', value: `${data.savings_rate.toFixed(1)}%`, icon: <TrendingUp size={13} />, color: data.savings_rate >= 20 ? '#22c55e' : data.savings_rate >= 10 ? '#f59e0b' : '#ef4444' },
              { label: 'Annual return', value: `${(settings.annual_return_rate * 100).toFixed(1)}%`, icon: <Zap size={13} />, color: '#7c3aed' },
              { label: 'Passive income/mo', value: fmtEur(data.net_worth * settings.annual_return_rate / 12), icon: <Flame size={13} />, color: '#f59e0b' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} style={{ background: 'var(--card)', padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '0.67rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{value}</p>
                </div>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${color} 12%, var(--background))`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TIME TO BROKE */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, #ef4444 12%, var(--background))', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={13} /></div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Time to Broke</h2>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>— month-by-month capital simulation</span>
          </div>
          <TimeToBrokeChart netWorth={data.net_worth} monthlyExpenses={data.avg_monthly_expenses} annualReturn={settings.annual_return_rate} isMobile={isMobile} />
        </div>

        {/* RUNWAY + NET WORTH */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, #3b82f6 12%, var(--background))', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={13} /></div>
              <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Runway Analysis</h2>
            </div>
            {data.runway_scenarios.map((s, i) => <RunwayBar key={s.label} scenario={s} maxMonths={maxRunway} index={i} />)}
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, #22c55e 12%, var(--background))', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={13} /></div>
                <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Net worth over time</h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>{fmtEur(data.net_worth)}</span>
            </div>
            <NetWorthChart history={data.net_worth_history} isMobile={isMobile} />
          </div>
        </div>

        {/* FIRE SCENARIOS */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, #f97316 12%, var(--background))', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Flame size={13} /></div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>FIRE Scenarios</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
            {data.fire_scenarios.map((s, i) => <FireScenarioCard key={s.label} scenario={s} isMiddle={i === 1} />)}
          </div>
        </div>

      </div>

      {showSettings && <SettingsModal initial={data.settings} onSave={saveSettings} onClose={() => setShowSettings(false)} saving={saving} />}
    </div>
  );
};
