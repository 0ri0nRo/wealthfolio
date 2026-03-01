// src/pages/fire/index.tsx
import { useBalancePrivacy } from '@/hooks/use-balance-privacy';
import { FireSettings, useFire } from '@/hooks/useFire';
import {
  Activity, ArrowRight, BarChart2, Eye, EyeOff, Flame, Play,
  Settings, Shield, Target, TrendingUp, X, Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

// ── Utils ─────────────────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [v, setV] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setV(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return v;
}

const fmtEur = (n: number, compact = true) => {
  if (compact) {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `€${(n / 1_000).toFixed(1)}k`;
  }
  return `€${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
};

const fmtEurOrHide = (n: number, hidden: boolean, compact = true) =>
  hidden ? (compact ? '€•••••' : '€••••••') : fmtEur(n, compact);

const fmtPct   = (n: number) => `${n.toFixed(1)}%`;
const fmtYears = (months: number) =>
  months >= 9990 ? '∞' : months >= 24 ? `${(months / 12).toFixed(1)} yrs` : `${Math.round(months)} mo`;

const NOW_LABEL = (() => {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
})();

function addMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
function fmtDateShort(d: Date) { return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`; }

// ── Settings Modal ────────────────────────────────────────────────────────────
const SettingsModal: React.FC<{
  initial:        FireSettings;
  onSave:         (s: FireSettings) => Promise<void>;
  onClose:        () => void;
  saving:         boolean;
  isBalanceHidden:       boolean;
  onToggleBalanceHidden: () => void;
}> = ({ initial, onSave, onClose, saving, isBalanceHidden, onToggleBalanceHidden }) => {
  const [form, setForm] = useState<FireSettings>({ ...initial });
  const set = (k: keyof FireSettings, v: any) => setForm(f => ({ ...f, [k]: v }));

  const field = (
    label: string, fieldKey: keyof FireSettings,
    opts: { prefix?: string; step?: number; hint?: string; placeholder?: string; pct?: boolean } = {}
  ) => {
    const { prefix = '€', step = 50, hint, placeholder, pct } = opts;
    const raw     = form[fieldKey] as number | null;
    const display = pct && raw != null ? (raw * 100).toFixed(1) : (raw ?? '');
    return (
      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
        {hint && <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '-0.1rem 0 0.35rem' }}>{hint}</p>}
        <div style={{ position: 'relative' }}>
          {prefix && <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '0.82rem', fontWeight: 600 }}>{prefix}</span>}
          <input
            type="number" step={step} value={display} placeholder={placeholder}
            onChange={e => { if (!e.target.value) { set(fieldKey, null); return; } const v = parseFloat(e.target.value); set(fieldKey, pct ? v / 100 : v); }}
            style={{ width: '100%', padding: prefix ? '0.6rem 0.75rem 0.6rem 1.75rem' : '0.6rem 0.75rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={15} color="var(--muted-foreground)" />
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--foreground)' }}>FIRE Settings</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4, display: 'flex', borderRadius: 6 }}><X size={16} /></button>
        </div>

        <div style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Display section — same pattern as Budget gear menu ── */}
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '0 0 0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Display</p>
            <div
              onClick={onToggleBalanceHidden}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem', background: 'var(--accent)', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
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
              {/* Same toggle pill as Budget */}
              <div style={{ width: 36, height: 20, borderRadius: '999px', flexShrink: 0, background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: isBalanceHidden ? 'calc(100% - 18px)' : '2px', width: 16, height: 16, borderRadius: '50%', background: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left 0.2s' }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* ── Calculation parameters ── */}
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '0 0 0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Calculation parameters</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '0 0 1rem', fontStyle: 'italic' }}>
              These drive all FIRE calculations. Monthly expenses are auto-derived from your last 12 months of budget data unless overridden.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {field('Monthly target spending',    'monthly_expenses',       { hint: 'Override: leave empty to use 12-month budget average' })}
              {field('Monthly net income',         'monthly_income_override', { hint: 'Override: leave empty to use budget average' })}
              {field('INPS unemployment benefit',  'inps_monthly',           { hint: 'Monthly INPS amount for the safety-net scenario' })}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>FIRE Number (optional)</label>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '-0.1rem 0 0.35rem' }}>If empty: expenses × 12 × 25 (4% rule)</p>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '0.82rem', fontWeight: 600 }}>€</span>
                  <input
                    type="number" step={5000} value={form.fire_number ?? ''}
                    placeholder={`Auto: ${fmtEur((form.monthly_expenses || 2000) * 12 * 25, false)}`}
                    onChange={e => set('fire_number', e.target.value ? parseFloat(e.target.value) : null)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 1.75rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {field('Annual return %', 'annual_return_rate', { prefix: '%', step: 0.5, pct: true })}
                {field('Inflation %',     'inflation_rate',     { prefix: '%', step: 0.5, pct: true })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {field('Current age',     'current_age',     { prefix: '', step: 1, placeholder: '—' })}
                {field('Target FIRE age', 'target_fire_age', { prefix: '', step: 1, placeholder: '—' })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.4rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.55rem 1.1rem', background: 'var(--muted)', border: 'none', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
          <button onClick={() => onSave(form).then(onClose)} disabled={saving}
            style={{ padding: '0.55rem 1.4rem', background: 'var(--foreground)', border: 'none', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--background)', fontFamily: 'var(--font-sans)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── FIRE Progress Bar ─────────────────────────────────────────────────────────
const FireProgress: React.FC<{ netWorth: number; fireNumber: number; isBalanceHidden: boolean }> = ({ netWorth, fireNumber, isBalanceHidden }) => {
  const pct = Math.min((netWorth / fireNumber) * 100, 100);
  const milestones = [25, 50, 75, 100];
  return (
    <div>
      <div style={{ position: 'relative', height: 12, background: 'var(--muted)', borderRadius: 999, overflow: 'visible', marginBottom: '0.5rem' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : `linear-gradient(90deg, #f97316, ${pct > 60 ? '#22c55e' : '#f59e0b'})`, borderRadius: 999, transition: 'width 1s ease', position: 'relative' }}>
          {pct > 4 && pct < 100 && (
            <div style={{ position: 'absolute', right: -1, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: '50%', background: 'var(--foreground)', border: '3px solid var(--background)', boxShadow: '0 0 0 2px var(--foreground)' }} />
          )}
        </div>
        {milestones.map(m => (
          <div key={m} style={{ position: 'absolute', left: `${m}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 4, height: 4, borderRadius: '50%', background: pct >= m ? 'rgba(255,255,255,0.6)' : 'var(--border)', pointerEvents: 'none', zIndex: 1 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>{fmtEurOrHide(netWorth, isBalanceHidden)} saved</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: pct >= 100 ? 'var(--success)' : 'var(--foreground)' }}>{isBalanceHidden ? '••.•%' : `${pct.toFixed(1)}%`}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Target: {fmtEurOrHide(fireNumber, isBalanceHidden)}</span>
      </div>
    </div>
  );
};

// ── Runway Card ───────────────────────────────────────────────────────────────
const RunwayCard: React.FC<{ scenarios: { label: string; months: number; description: string }[] }> = ({ scenarios }) => {
  const COLORS  = ['var(--color-blue-600)', 'var(--color-orange-400)', 'var(--success)'];
  const maxMonths = Math.max(...scenarios.filter(s => s.months < 9990).map(s => s.months), 60);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {scenarios.map((s, i) => {
        const color = COLORS[i % COLORS.length];
        const isInf = s.months >= 9990;
        const pct   = isInf ? 100 : Math.min((s.months / maxMonths) * 100, 100);
        return (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>{s.label}</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{isInf ? '∞' : fmtYears(s.months)}</span>
            </div>
            <div style={{ background: 'var(--muted)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: color, transition: 'width 1s ease' }} />
            </div>
            <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '0.25rem 0 0' }}>{s.description}</p>
          </div>
        );
      })}
    </div>
  );
};

// ── Capital Depletion Chart ───────────────────────────────────────────────────
const TtbChart: React.FC<{ netWorth: number; monthlyExpenses: number; annualReturn: number; isMobile: boolean; isBalanceHidden: boolean }> = ({ netWorth, monthlyExpenses, annualReturn, isMobile, isBalanceHidden }) => {
  const pts = useMemo(() => {
    const r = annualReturn / 12;
    const res: { m: number; d: Date; cap: number; ret: number }[] = [];
    let cap = netWorth, ret = netWorth;
    const start = new Date();
    for (let m = 0; m <= 480; m++) {
      res.push({ m, d: addMonths(start, m), cap: Math.max(cap, 0), ret: Math.max(ret, 0) });
      if (cap <= 0 && ret <= 0) break;
      cap -= monthlyExpenses;
      ret  = ret * (1 + r) - monthlyExpenses;
    }
    return res;
  }, [netWorth, monthlyExpenses, annualReturn]);

  const zeroCap = pts.find(p => p.cap <= 0);
  const zeroRet = pts.find(p => p.ret <= 0);
  const maxM    = pts[pts.length - 1].m;
  const W = isMobile ? 320 : 520, H = 190;
  const P = { t: 18, b: 28, l: 50, r: 12 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const sx = (m: number) => P.l + (m / maxM) * cW;
  const sy = (v: number) => P.t + (1 - Math.min(v, netWorth) / netWorth) * cH;

  const buildPath = (key: 'cap' | 'ret') => {
    const active = pts.filter((p, i) => p[key] > 0 || i === 0);
    const last   = active[active.length - 1];
    const nxt    = pts[pts.indexOf(last) + 1];
    const tail   = nxt ? ` L ${sx(nxt.m)},${sy(0)}` : '';
    return active.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.m)},${sy(p[key])}`).join(' ') + tail;
  };
  const buildArea = (key: 'cap' | 'ret') => {
    const path = buildPath(key);
    const zero = key === 'cap' ? (zeroCap ? sx(zeroCap.m) : sx(maxM)) : (zeroRet ? sx(zeroRet.m) : sx(maxM));
    return `${path} L ${zero},${sy(0)} L ${P.l},${sy(0)} Z`;
  };

  const tickEvery = maxM <= 36 ? 6 : maxM <= 120 ? 12 : 24;

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { color: 'var(--destructive)', label: `Capital only → broke ${zeroCap ? fmtDateShort(zeroCap.d) : '∞'}` },
          { color: 'var(--success)',     label: `With returns → broke ${zeroRet ? fmtDateShort(zeroRet.d) : '∞'}` },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 3, borderRadius: 2, background: color }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>{label}</span>
          </div>
        ))}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="ttbRed"   x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e5484d" stopOpacity=".14"/><stop offset="100%" stopColor="#e5484d" stopOpacity="0"/></linearGradient>
          <linearGradient id="ttbGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30a46c" stopOpacity=".12"/><stop offset="100%" stopColor="#30a46c" stopOpacity="0"/></linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y     = sy(netWorth * f);
          const label = isBalanceHidden ? '•••' : (netWorth * f >= 1000 ? `€${((netWorth * f) / 1000).toFixed(0)}k` : `€${netWorth * f}`);
          return (
            <g key={f}>
              <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="var(--border)" strokeWidth=".6" strokeDasharray="3,3" />
              <text x={P.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{label}</text>
            </g>
          );
        })}
        <path d={buildArea('cap')} fill="url(#ttbRed)" />
        <path d={buildArea('ret')} fill="url(#ttbGreen)" />
        <path d={buildPath('cap')} fill="none" stroke="#e5484d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={buildPath('ret')} fill="none" stroke="#30a46c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {zeroCap && <>
          <line x1={sx(zeroCap.m)} y1={P.t} x2={sx(zeroCap.m)} y2={sy(0)} stroke="#e5484d" strokeWidth="1" strokeDasharray="4,3" />
          <circle cx={sx(zeroCap.m)} cy={sy(0)} r={4} fill="#e5484d" />
          <text x={sx(zeroCap.m)} y={P.t - 3} textAnchor="middle" fontSize="8" fill="#e5484d" fontFamily="var(--font-sans)" fontWeight="700">{fmtDateShort(zeroCap.d)}</text>
        </>}
        {zeroRet && <>
          <line x1={sx(zeroRet.m)} y1={P.t} x2={sx(zeroRet.m)} y2={sy(0)} stroke="#30a46c" strokeWidth="1" strokeDasharray="4,3" />
          <circle cx={sx(zeroRet.m)} cy={sy(0)} r={4} fill="#30a46c" />
          <text x={sx(zeroRet.m)} y={P.t - 3} textAnchor="middle" fontSize="8" fill="#30a46c" fontFamily="var(--font-sans)" fontWeight="700">{fmtDateShort(zeroRet.d)}</text>
        </>}
        {pts.filter(p => p.m % tickEvery === 0).map(p => (
          <text key={p.m} x={sx(p.m)} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{fmtDateShort(p.d)}</text>
        ))}
      </svg>

      <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Capital only', value: zeroCap ? `${zeroCap.m} months` : '∞', color: 'var(--destructive)' },
          { label: 'With returns', value: zeroRet ? `${zeroRet.m} months` : '∞', color: 'var(--success)' },
          { label: 'Extra runway', value: zeroCap && zeroRet ? `+${zeroRet.m - zeroCap.m} months` : '∞', color: 'var(--color-purple-600)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, background: `color-mix(in srgb, ${color} 10%, var(--background))`, border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`, borderRadius: '10px', padding: '0.55rem 0.9rem' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ fontSize: '0.88rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Net Worth Sparkline ───────────────────────────────────────────────────────
const NetWorthSparkline: React.FC<{ history: { date: string; total_value: number }[]; isMobile: boolean }> = ({ history, isMobile }) => {
  if (history.length < 2) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>Not enough data yet</div>
  );
  const W = isMobile ? 300 : 460, H = 100;
  const P = { t: 8, b: 22, l: 6, r: 6 };
  const vals = history.map(p => p.total_value);
  const min  = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts  = history.map((p, i) => {
    const x = P.l + (i / (history.length - 1)) * (W - P.l - P.r);
    const y = P.t + (1 - (p.total_value - min) / rng) * (H - P.t - P.b);
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(' L ')}`, areaD = `${pathD} L ${W - P.r},${H - P.b} L ${P.l},${H - P.b} Z`;
  const isUp  = vals[vals.length - 1] >= vals[0];
  const color = isUp ? '#30a46c' : '#e5484d';
  const [lx, ly] = pts[pts.length - 1].split(',').map(Number);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sparkG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".18"/><stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkG)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={4} fill={color} />
      {[0, Math.floor(history.length / 2), history.length - 1].map(i => {
        const [x] = pts[i].split(',').map(Number);
        const d   = new Date(history[i].date);
        return <text key={i} x={x} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{`${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`}</text>;
      })}
    </svg>
  );
};

// ── Simulation Panel ──────────────────────────────────────────────────────────
interface SimResult { months: number; finalWealth: number; totalContributions: number; totalGains: number; }

function runSimulation(startCapital: number, monthlyContrib: number, annualReturn: number, horizonYears: number): SimResult {
  const months = horizonYears * 12, r = annualReturn / 12;
  let w = startCapital;
  for (let i = 0; i < months; i++) w = w * (1 + r) + monthlyContrib;
  const totalContrib = monthlyContrib * months;
  return { months, finalWealth: w, totalContributions: startCapital + totalContrib, totalGains: w - startCapital - totalContrib };
}

function buildSimPath(startCapital: number, monthlyContrib: number, annualReturn: number, horizonYears: number) {
  const r = annualReturn / 12;
  const pts: { m: number; wealth: number; contributions: number }[] = [];
  let w = startCapital, totalC = startCapital;
  const months = horizonYears * 12;
  for (let m = 0; m <= months; m++) {
    pts.push({ m, wealth: w, contributions: totalC });
    w = w * (1 + r) + monthlyContrib;
    totalC += monthlyContrib;
  }
  return pts;
}

const SimulationPanel: React.FC<{ currentNetWorth: number; defaultMonthlyContrib: number; defaultReturn: number; isMobile: boolean; isBalanceHidden: boolean }> = ({
  currentNetWorth, defaultMonthlyContrib, defaultReturn, isMobile, isBalanceHidden,
}) => {
  const [monthly,     setMonthly]  = useState(defaultMonthlyContrib > 0 ? Math.round(defaultMonthlyContrib) : 500);
  const [returnPct,   setReturn]   = useState(+(defaultReturn * 100).toFixed(1) || 6);
  const [horizon,     setHorizon]  = useState(10);
  const [includeBase, setBase]     = useState(true);

  const result = useMemo(() => runSimulation(includeBase ? currentNetWorth : 0, monthly, returnPct / 100, horizon), [includeBase, currentNetWorth, monthly, returnPct, horizon]);
  const simPts = useMemo(() => buildSimPath(includeBase ? currentNetWorth : 0, monthly, returnPct / 100, horizon), [includeBase, currentNetWorth, monthly, returnPct, horizon]);

  const W = isMobile ? 320 : 500, H = 160;
  const P = { t: 12, b: 24, l: 52, r: 12 };
  const maxY  = Math.max(...simPts.map(p => p.wealth), ...simPts.map(p => p.contributions), 1);
  const sx    = (m: number) => P.l + (m / result.months) * (W - P.l - P.r);
  const sy    = (v: number) => P.t + (1 - v / maxY) * (H - P.t - P.b);
  const wPath = simPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.m)},${sy(p.wealth)}`).join(' ');
  const cPath = simPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.m)},${sy(p.contributions)}`).join(' ');
  const wArea = `${wPath} L ${sx(result.months)},${sy(0)} L ${P.l},${sy(0)} Z`;

  const range = (label: string, val: number, min: number, max: number, step: number, fmt: (v: number) => string, onChange: (v: number) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{fmt(val)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--foreground)', cursor: 'pointer', height: 4 }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {range('Monthly savings', monthly,    0,    5000, 50,  v => `€${v.toLocaleString()}`, setMonthly)}
          {range('Annual return',   returnPct,  0,    15,   0.5, v => `${v.toFixed(1)}%`,       setReturn)}
          {range('Time horizon',    horizon,    1,    40,   1,   v => `${v} years`,              setHorizon)}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '0.25rem' }}>
            <div onClick={() => setBase(v => !v)}
              style={{ width: 36, height: 20, borderRadius: 999, background: includeBase ? 'var(--foreground)' : 'var(--muted)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: includeBase ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: includeBase ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              Start from current net worth ({fmtEurOrHide(currentNetWorth, isBalanceHidden)})
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', alignContent: 'start' }}>
          {[
            { label: 'Final wealth',      value: fmtEurOrHide(result.finalWealth,        isBalanceHidden, false), color: 'var(--success)',          large: true  },
            { label: 'Total gains',       value: fmtEurOrHide(result.totalGains,          isBalanceHidden, false), color: 'var(--color-purple-600)', large: false },
            { label: 'Total contributed', value: fmtEurOrHide(result.totalContributions,  isBalanceHidden, false), color: 'var(--foreground)',        large: false },
            { label: 'Gain multiple',     value: isBalanceHidden ? '×••••' : result.totalContributions > 0 ? `${(result.finalWealth / result.totalContributions).toFixed(2)}×` : '—', color: 'var(--color-orange-400)', large: false },
          ].map(({ label, value, color, large }) => (
            <div key={label} style={{ background: 'var(--accent)', borderRadius: '12px', padding: '0.75rem 0.9rem', gridColumn: large ? 'span 2' : undefined }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
              <p style={{ fontSize: large ? '1.5rem' : '1rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.03em' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          {[{ color: '#30a46c', label: 'Projected wealth (with compound returns)' }, { color: 'var(--muted-foreground)', label: 'Total contributions (no returns)' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 18, height: 3, borderRadius: 2, background: color }} />
              <span style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)' }}>{label}</span>
            </div>
          ))}
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
          <defs><linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30a46c" stopOpacity=".16"/><stop offset="100%" stopColor="#30a46c" stopOpacity="0"/></linearGradient></defs>
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y     = sy(maxY * f);
            const label = isBalanceHidden ? '•••' : (maxY * f >= 1_000_000 ? `€${((maxY * f) / 1_000_000).toFixed(1)}M` : maxY * f >= 1_000 ? `€${((maxY * f) / 1_000).toFixed(0)}k` : `€${Math.round(maxY * f)}`);
            return (
              <g key={f}>
                <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="var(--border)" strokeWidth=".5" strokeDasharray="3,3" />
                <text x={P.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{label}</text>
              </g>
            );
          })}
          <path d={wArea} fill="url(#simGrad)" />
          <path d={cPath} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="5,4" />
          <path d={wPath} fill="none" stroke="#30a46c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {Array.from({ length: horizon + 1 }, (_, i) => {
            if (i % Math.max(1, Math.floor(horizon / 5)) !== 0) return null;
            const x = sx(i * 12), d = addMonths(new Date(), i * 12);
            return <text key={i} x={x} y={H - 5} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{d.getFullYear()}</text>;
          })}
          {(() => { const lp = simPts[simPts.length - 1]; return <circle cx={sx(lp.m)} cy={sy(lp.wealth)} r={5} fill="#30a46c" stroke="var(--background)" strokeWidth="2" />; })()}
        </svg>
      </div>
    </div>
  );
};

// ── FIRE Scenario Card ────────────────────────────────────────────────────────
const FireScenario: React.FC<{
  s:               { label: string; monthly_target: number; fire_number: number; months_to_fire: number | null; years_to_fire: number | null };
  highlight?:      boolean;
  isBalanceHidden: boolean;
}> = ({ s, highlight, isBalanceHidden }) => {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    'Lean FIRE':    { color: 'var(--color-blue-600)',    icon: <Zap size={13} /> },
    'Regular FIRE': { color: 'var(--color-orange-400)', icon: <Flame size={13} /> },
    'Fat FIRE':     { color: 'var(--success)',           icon: <Shield size={13} /> },
  };
  const { color, icon } = map[s.label] ?? map['Regular FIRE'];
  const achieved = s.months_to_fire === 0;
  return (
    <div style={{ background: 'var(--card)', border: highlight ? `2px solid ${color}` : '1px solid var(--border)', borderRadius: '16px', padding: '1.1rem 1.25rem', boxShadow: highlight ? `0 4px 20px color-mix(in srgb, ${color} 18%, transparent)` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `color-mix(in srgb, ${color} 12%, var(--background))`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)' }}>{s.label}</span>
        {highlight && <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `color-mix(in srgb, ${color} 12%, var(--background))`, color }}>Target</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
        <div>
          <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monthly</p>
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{fmtEurOrHide(s.monthly_target, isBalanceHidden)}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Number</p>
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color, margin: 0 }}>{fmtEurOrHide(s.fire_number, isBalanceHidden)}</p>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Time to FIRE</p>
          <p style={{ fontSize: achieved ? '1.1rem' : '1.25rem', fontWeight: 800, color: achieved ? 'var(--success)' : 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
            {s.months_to_fire === null ? '—' : achieved ? '🎉 Achieved!' : s.years_to_fire !== null ? `${s.years_to_fire.toFixed(1)} years` : '—'}
          </p>
          {s.months_to_fire !== null && s.months_to_fire > 0 && (
            <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{Math.round(s.months_to_fire)} months</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Wealth Health Score ───────────────────────────────────────────────────────
const HealthScore: React.FC<{ score: number; isMobile: boolean }> = ({ score, isMobile }) => {
  const size   = isMobile ? 130 : 160, sw = 11;
  const r      = (size - sw * 2) / 2, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color  = score < 25 ? 'var(--destructive)' : score < 50 ? 'var(--color-orange-400)' : score < 75 ? 'var(--color-yellow-400, #d0a215)' : 'var(--success)';
  const label  = score < 25 ? 'Critical' : score < 50 ? 'Caution' : score < 75 ? 'Good' : 'Excellent';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: isMobile ? '1.7rem' : '2rem', fontWeight: 900, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{Math.round(score)}</span>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
    </div>
  );
};

// ── Card wrapper ──────────────────────────────────────────────────────────────
const Card: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; action?: React.ReactNode }> = ({ title, subtitle, icon, children, style, action }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', ...style }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon}
        <div>
          <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)' }}>{title}</h2>
          {subtitle && <p style={{ margin: '1px 0 0', fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const CardIcon: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, var(--background))`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {children}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export const FirePage: React.FC = () => {
  const { data, loading, error, saving, refresh, saveSettings } = useFire();
  // Same hook as Budget — state is shared automatically via whatever storage
  // mechanism use-balance-privacy uses (localStorage, context, etc.)
  const { isBalanceHidden, toggleBalanceVisibility } = useBalancePrivacy();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab,    setActiveTab]    = useState<'overview' | 'simulation' | 'scenarios'>('overview');
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

  const s              = data.settings;
  const fireNum        = s.fire_number ?? data.avg_monthly_expenses * 12 * 25;
  const firePct        = Math.min((data.net_worth / fireNum) * 100, 100);
  const passiveMonthly = data.net_worth * s.annual_return_rate / 12;
  const coverageRatio  = data.avg_monthly_expenses > 0 ? (passiveMonthly / data.avg_monthly_expenses) * 100 : 0;

  const isCoastFire = (() => {
    if (!s.current_age || !s.target_fire_age) return false;
    const yrs = s.target_fire_age - s.current_age;
    if (yrs <= 0) return false;
    return data.net_worth * Math.pow(1 + s.annual_return_rate, yrs) >= fireNum;
  })();

  const TABS: [typeof activeTab, string][] = [
    ['overview',   'Overview'],
    ['simulation', '💡 Simulator'],
    ['scenarios',  'FIRE Scenarios'],
  ];

  const statTiles = [
    { label: 'Avg income/mo',  value: fmtEurOrHide(data.avg_monthly_income,   isBalanceHidden), color: 'var(--success)' },
    { label: 'Avg expenses/mo', value: fmtEurOrHide(data.avg_monthly_expenses, isBalanceHidden), color: 'var(--destructive)' },
    { label: 'Savings/mo',      value: fmtEurOrHide(data.avg_monthly_savings,  isBalanceHidden), color: data.avg_monthly_savings >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)' },
    { label: 'Savings rate',    value: isBalanceHidden ? '••.•%' : fmtPct(data.savings_rate),   color: data.savings_rate >= 20 ? 'var(--success)' : 'var(--color-orange-400)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'color-mix(in srgb, var(--background) 92%, transparent)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          paddingLeft:  'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          height: 52, display: 'flex', alignItems: 'center', gap: '0.4rem',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            <Flame size={16} color="#f97316" />
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>FIRE</span>
          </div>

          <div style={{ display: 'flex', gap: '2px', background: 'var(--muted)', borderRadius: '10px', padding: '3px', marginLeft: '6px', minWidth: 0, overflow: 'hidden' }}>
            {TABS.map(([key, label]) => (
              <span key={key} onClick={() => setActiveTab(key)} style={{
                fontSize: '0.73rem', fontWeight: 600,
                padding: isMobile ? '4px 7px' : '4px 11px',
                borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center',
                background:  activeTab === key ? 'var(--card)' : 'transparent',
                color:       activeTab === key ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow:   activeTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent', userSelect: 'none',
              }}>{label}</span>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {!isMobile && (
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 500, flexShrink: 0 }}>
              Snapshot · <strong style={{ color: 'var(--foreground)' }}>{NOW_LABEL}</strong>
            </span>
          )}

          {/* Hide/show — same visual as Budget gear button when active */}
          <button
            onClick={toggleBalanceVisibility}
            title={isBalanceHidden ? 'Show values' : 'Hide values'}
            style={{
              width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: isMobile ? 0 : '0.3rem',
              background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)',
              color:      isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)',
              border: 'none', borderRadius: '10px', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 600,
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            {isBalanceHidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>

          <button onClick={() => setShowSettings(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: isMobile ? 0 : '0.3rem',
              padding: isMobile ? '7px 9px' : '7px 12px',
              background: 'var(--muted)', color: 'var(--foreground)',
              border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', flexShrink: 0,
            }}>
            <Settings size={13} />
            {!isMobile && 'Settings'}
          </button>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(180deg, color-mix(in srgb, var(--success) 7%, var(--background)) 0%, var(--background) 65%)`, borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '1.5rem 1rem 1.25rem' : '2rem 1.5rem 1.5rem' }}>
          {isMobile && <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '0 0 0.5rem', fontWeight: 500 }}>Snapshot · {NOW_LABEL}</p>}

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '1.25rem' : '2rem' }}>
            <HealthScore score={data.freedom_score} isMobile={isMobile} />

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Worth</p>
              <p style={{ fontSize: isMobile ? '2.5rem' : '3rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 0.6rem' }}>
                {fmtEurOrHide(data.net_worth, isBalanceHidden, false)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: coverageRatio >= 100 ? 'var(--success)' : 'var(--color-orange-400)' }}>
                  {isBalanceHidden ? '••%' : `${coverageRatio.toFixed(0)}%`} passive coverage
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                  {fmtEurOrHide(passiveMonthly, isBalanceHidden)}/mo from returns
                </span>
                {isCoastFire && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'color-mix(in srgb, var(--success) 12%, var(--background))', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}>
                    🏖️ Coast FIRE
                  </span>
                )}
              </div>
              <div style={{ maxWidth: 540 }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  FIRE Progress · {isBalanceHidden ? '••.•%' : fmtPct(firePct)}
                </p>
                <FireProgress netWorth={data.net_worth} fireNumber={fireNum} isBalanceHidden={isBalanceHidden} />
              </div>
            </div>

            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden', flexShrink: 0, width: 280 }}>
                {statTiles.map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'var(--card)', padding: '0.85rem 1rem' }}>
                    <p style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color, letterSpacing: '-0.02em' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: isMobile
          ? `1.25rem 1rem calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)`
          : '1.75rem 1.5rem',
        display: 'flex', flexDirection: 'column', gap: '1.25rem',
      }}>

        {isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            {statTiles.map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--card)', padding: '0.85rem 1rem' }}>
                <p style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, color, letterSpacing: '-0.02em' }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
              <Card title="Runway — how long can you live without working?" subtitle="Based on your 12-month average expenses" icon={<CardIcon color="var(--color-blue-600)"><Shield size={13} /></CardIcon>}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.04em', lineHeight: 1 }}>{fmtYears(data.runway_scenarios[0]?.months ?? 0)}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: '4px 0 0' }}>without any income · {fmtEurOrHide(data.avg_monthly_expenses, isBalanceHidden)}/mo avg expense (last 12 months)</p>
                </div>
                <RunwayCard scenarios={data.runway_scenarios} />
              </Card>
              <Card title="Net Worth History" subtitle="Portfolio value over time" icon={<CardIcon color="var(--success)"><TrendingUp size={13} /></CardIcon>} action={<span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--foreground)' }}>{fmtEurOrHide(data.net_worth, isBalanceHidden)}</span>}>
                <NetWorthSparkline history={data.net_worth_history} isMobile={isMobile} />
              </Card>
            </div>

            <Card title="Capital Depletion" subtitle="Month-by-month simulation of how long your wealth lasts" icon={<CardIcon color="var(--destructive)"><Activity size={13} /></CardIcon>}>
              <TtbChart netWorth={data.net_worth} monthlyExpenses={data.avg_monthly_expenses} annualReturn={s.annual_return_rate} isMobile={isMobile} isBalanceHidden={isBalanceHidden} />
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
                { label: 'Passive income/mo', value: fmtEurOrHide(passiveMonthly, isBalanceHidden),                                                                                         icon: <Zap size={13} />,      color: 'var(--color-orange-400)' },
                { label: 'Expense coverage',  value: isBalanceHidden ? '••%' : `${coverageRatio.toFixed(0)}%`,                                                                              icon: <Target size={13} />,    color: coverageRatio >= 100 ? 'var(--success)' : 'var(--color-orange-400)' },
                { label: 'Annual return',     value: `${(s.annual_return_rate * 100).toFixed(1)}%`,                                                                                         icon: <BarChart2 size={13} />, color: 'var(--color-purple-600)' },
                { label: 'Time to FIRE',      value: data.fire_scenarios[1]?.years_to_fire != null ? `${data.fire_scenarios[1].years_to_fire.toFixed(1)} yrs` : '—',                       icon: <Flame size={13} />,     color: '#f97316' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{ background: 'var(--card)', padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{value}</p>
                  </div>
                  <CardIcon color={color}>{icon}</CardIcon>
                </div>
              ))}
            </div>

            <div onClick={() => setActiveTab('simulation')} style={{ padding: '1rem 1.25rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.15s', WebkitTapHighlightColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, #f97316 12%, var(--background))', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={15} /></div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>What-if Simulator</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Project your wealth: adjust monthly savings, return rate and horizon</p>
                </div>
              </div>
              <ArrowRight size={16} color="var(--muted-foreground)" />
            </div>
          </>
        )}

        {activeTab === 'simulation' && (
          <Card title="What-if Simulator" subtitle="Adjust the sliders to project your wealth growth" icon={<CardIcon color="#f97316"><Play size={13} /></CardIcon>}>
            <SimulationPanel currentNetWorth={data.net_worth} defaultMonthlyContrib={data.avg_monthly_savings} defaultReturn={s.annual_return_rate} isMobile={isMobile} isBalanceHidden={isBalanceHidden} />
          </Card>
        )}

        {activeTab === 'scenarios' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
              {data.fire_scenarios.map((s, i) => <FireScenario key={s.label} s={s} highlight={i === 1} isBalanceHidden={isBalanceHidden} />)}
            </div>
            <Card title="Data sources" subtitle="Figures derived from your last 12 months of budget transactions" icon={<CardIcon color="var(--color-blue-600)"><BarChart2 size={13} /></CardIcon>}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.65rem' }}>
                {[
                  { label: '12-month avg income',  value: fmtEurOrHide(data.avg_monthly_income,   isBalanceHidden, false), sub: 'per month' },
                  { label: '12-month avg expenses', value: fmtEurOrHide(data.avg_monthly_expenses, isBalanceHidden, false), sub: 'per month' },
                  { label: 'Avg net savings',       value: fmtEurOrHide(data.avg_monthly_savings,  isBalanceHidden, false), sub: 'per month' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ background: 'var(--accent)', borderRadius: '12px', padding: '0.85rem 1rem' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.03em' }}>{value}</p>
                    <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{sub}</p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          initial={data.settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
          saving={saving}
          isBalanceHidden={isBalanceHidden}
          onToggleBalanceHidden={toggleBalanceVisibility}
        />
      )}
    </div>
  );
};
