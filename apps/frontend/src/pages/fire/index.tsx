// src/pages/fire/index.tsx
import { useBalancePrivacy } from '@/hooks/use-balance-privacy';
import { FireSettings, useFire } from '@/hooks/useFire';
import {
  Activity, ArrowRight, BarChart2, Eye, EyeOff, Flame,
  Play, Settings, Shield, Target, TrendingUp, X, Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [v, setV] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setV(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return v;
}

const fmtEurFull = (n: number) =>
  `€${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const fmtEurCompact = (n: number) => {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(1)}k`;
  return fmtEurFull(n);
};

const fmtOrHide = (n: number, hidden: boolean, compact = false) =>
  hidden ? '€••••••' : (compact ? fmtEurCompact(n) : fmtEurFull(n));

const fmtYears = (months: number) =>
  months >= 9990 ? '∞' : months >= 24 ? `${(months / 12).toFixed(1)} yrs` : `${Math.round(months)} mo`;

function addMonths(d: Date, n: number) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
function mmyy(d: Date) { return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`; }

const NOW_LABEL = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// ── Net Worth Sparkline ───────────────────────────────────────────────────────
const HeroChart: React.FC<{ history: { date: string; total_value: number }[]; hidden: boolean }> = ({ history, hidden }) => {
  const [hover, setHover] = useState<{ x: number; y: number; val: number; date: string } | null>(null);

  const sorted = useMemo(() => [...history].sort((a, b) => a.date.localeCompare(b.date)), [history]);
  if (sorted.length < 2) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>
      Not enough history to display chart
    </div>
  );

  const vals = sorted.map(p => p.total_value);
  const minV = Math.min(...vals), maxV = Math.max(...vals), rng = maxV - minV || 1;

  const W = 1000, H = 180, PL = 0, PR = 0, PT = 16, PB = 0;
  const sx = (i: number) => PL + (i / (sorted.length - 1)) * (W - PL - PR);
  const sy = (v: number) => PT + (1 - (v - minV) / rng) * (H - PT - PB);

  const pts = sorted.map((p, i) => ({ x: sx(i), y: sy(p.total_value), val: p.total_value, date: p.date }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${W - PR} ${H} L ${PL} ${H} Z`;
  const color = '#30a46c';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(xRatio * (sorted.length - 1));
    const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
    const p = pts[clamped];
    setHover({ x: p.x / W * 100, y: p.y / H * 100, val: p.val, date: sorted[clamped].date });
  };

  const tickIdxs = [0, Math.floor(sorted.length / 4), Math.floor(sorted.length / 2), Math.floor(3 * sorted.length / 4), sorted.length - 1];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 200, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#heroGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {hover && <>
          <line x1={hover.x / 100 * W} y1={PT} x2={hover.x / 100 * W} y2={H} stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity=".5" />
          <circle cx={hover.x / 100 * W} cy={hover.y / 100 * H} r={5} fill={color} stroke="white" strokeWidth="2" />
        </>}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 0', position: 'relative' }}>
        {tickIdxs.map(i => {
          const d = new Date(sorted[i].date);
          return (
            <span key={i} style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
              {d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
            </span>
          );
        })}
      </div>

      {hover && (
        <div style={{
          position: 'absolute', top: 12,
          left: `clamp(0px, calc(${hover.x}% - 70px), calc(100% - 140px))`,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '6px 12px', pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,.08)', fontSize: '0.75rem', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'var(--muted-foreground)', fontWeight: 500, marginRight: 8 }}>
            {new Date(hover.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span style={{ color: color, fontWeight: 700 }}>{hidden ? '€••••••' : fmtEurFull(hover.val)}</span>
        </div>
      )}
    </div>
  );
};

// ── FIRE Progress bar ─────────────────────────────────────────────────────────
const FireProgress: React.FC<{ netWorth: number; fireNumber: number; hidden: boolean }> = ({ netWorth, fireNumber, hidden }) => {
  const pct = Math.min((netWorth / fireNumber) * 100, 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FIRE Progress</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: pct >= 100 ? '#30a46c' : 'var(--foreground)' }}>{hidden ? '••.•%' : `${pct.toFixed(1)}%`}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: pct >= 100 ? '#30a46c' : `linear-gradient(90deg, #f97316 0%, ${pct > 60 ? '#30a46c' : '#f59e0b'} 100%)`, transition: 'width 1.2s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>{hidden ? '€••••••' : fmtEurCompact(netWorth)} saved</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>Goal: {hidden ? '€••••••' : fmtEurCompact(fireNumber)}</span>
      </div>
    </div>
  );
};

// ── Runway bars ───────────────────────────────────────────────────────────────
// FIX MOBILE: etichetta non si tronca, larghezza ridotta da 140px a 110px
const RunwayRow: React.FC<{ label: string; months: number; description: string; color: string; maxMonths: number }> = ({ label, months, color, maxMonths }) => {
  const isInf = months >= 9990;
  const pct   = isInf ? 100 : Math.min((months / maxMonths) * 100, 100);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 72px', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{label}</span>
      <div style={{ background: 'var(--border)', borderRadius: 999, height: 7, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: color, transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, textAlign: 'right' }}>{isInf ? '∞' : fmtYears(months)}</span>
    </div>
  );
};

// ── Capital Depletion Chart ───────────────────────────────────────────────────
const DepletionChart: React.FC<{ netWorth: number; monthlyExpenses: number; annualReturn: number; hidden: boolean }> = ({ netWorth, monthlyExpenses, annualReturn, hidden }) => {
  const pts = useMemo(() => {
    const r = annualReturn / 12;
    const res: { m: number; d: Date; cap: number; ret: number }[] = [];
    let cap = netWorth, ret = netWorth;
    for (let m = 0; m <= 480; m++) {
      res.push({ m, d: addMonths(new Date(), m), cap: Math.max(cap, 0), ret: Math.max(ret, 0) });
      if (cap <= 0 && ret <= 0) break;
      cap -= monthlyExpenses;
      ret  = ret * (1 + r) - monthlyExpenses;
    }
    return res;
  }, [netWorth, monthlyExpenses, annualReturn]);

  const zeroCap = pts.find(p => p.cap <= 0);
  const zeroRet = pts.find(p => p.ret <= 0);
  const maxM = pts[pts.length - 1].m;
  const W = 1000, H = 180, PL = 52, PR = 12, PT = 18, PB = 24;
  const sx = (m: number) => PL + (m / maxM) * (W - PL - PR);
  const sy = (v: number) => PT + (1 - Math.min(v, netWorth) / netWorth) * (H - PT - PB);
  const buildLine = (key: 'cap' | 'ret') => {
    const active = pts.filter((p, i) => p[key] > 0 || i === 0);
    const last = active[active.length - 1];
    const nxt  = pts[pts.indexOf(last) + 1];
    const tail = nxt ? ` L ${sx(nxt.m)} ${sy(0)}` : '';
    return active.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.m)} ${sy(p[key])}`).join(' ') + tail;
  };
  const buildArea = (key: 'cap' | 'ret') => {
    const line = buildLine(key);
    const endX = key === 'cap' ? (zeroCap ? sx(zeroCap.m) : sx(maxM)) : (zeroRet ? sx(zeroRet.m) : sx(maxM));
    return `${line} L ${endX} ${sy(0)} L ${PL} ${sy(0)} Z`;
  };
  const tickEvery = maxM <= 36 ? 6 : maxM <= 120 ? 12 : 24;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { color: '#e5484d', label: `Capital only → ${zeroCap ? mmyy(zeroCap.d) : '∞'}` },
          { color: '#30a46c', label: `With returns → ${zeroRet ? mmyy(zeroRet.d) : '∞'}` },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 18, height: 2.5, borderRadius: 2, background: color }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 180, overflow: 'visible' }}>
        <defs>
          <linearGradient id="dr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e5484d" stopOpacity=".12"/><stop offset="100%" stopColor="#e5484d" stopOpacity="0"/></linearGradient>
          <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30a46c" stopOpacity=".10"/><stop offset="100%" stopColor="#30a46c" stopOpacity="0"/></linearGradient>
        </defs>
        {yTicks.map(f => {
          const y = sy(netWorth * f);
          const label = hidden ? '•••' : netWorth * f >= 1000 ? `€${((netWorth * f) / 1000).toFixed(0)}k` : `€${Math.round(netWorth * f)}`;
          return (
            <g key={f}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth=".5" strokeDasharray="3,3" />
              <text x={PL - 5} y={y + 3} textAnchor="end" fontSize="9" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{label}</text>
            </g>
          );
        })}
        <path d={buildArea('cap')} fill="url(#dr)" />
        <path d={buildArea('ret')} fill="url(#dg)" />
        <path d={buildLine('cap')} fill="none" stroke="#e5484d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={buildLine('ret')} fill="none" stroke="#30a46c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {zeroCap && <>
          <line x1={sx(zeroCap.m)} y1={PT} x2={sx(zeroCap.m)} y2={sy(0)} stroke="#e5484d" strokeWidth="1" strokeDasharray="3,3" opacity=".6" />
          <circle cx={sx(zeroCap.m)} cy={sy(0)} r={3.5} fill="#e5484d" />
        </>}
        {zeroRet && <>
          <line x1={sx(zeroRet.m)} y1={PT} x2={sx(zeroRet.m)} y2={sy(0)} stroke="#30a46c" strokeWidth="1" strokeDasharray="3,3" opacity=".6" />
          <circle cx={sx(zeroRet.m)} cy={sy(0)} r={3.5} fill="#30a46c" />
        </>}
        {pts.filter(p => p.m % tickEvery === 0).map(p => (
          <text key={p.m} x={sx(p.m)} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{mmyy(p.d)}</text>
        ))}
      </svg>
    </div>
  );
};

// ── Simulator ─────────────────────────────────────────────────────────────────
function runSim(capital: number, monthly: number, rate: number, years: number) {
  const r = rate / 12, months = years * 12;
  let w = capital;
  for (let i = 0; i < months; i++) w = w * (1 + r) + monthly;
  const contrib = capital + monthly * months;
  return { finalWealth: w, totalContributions: contrib, totalGains: w - contrib };
}
function simPath(capital: number, monthly: number, rate: number, years: number) {
  const r = rate / 12, months = years * 12;
  const pts: { m: number; w: number; c: number }[] = [];
  let w = capital, c = capital;
  for (let m = 0; m <= months; m++) { pts.push({ m, w, c }); w = w * (1 + r) + monthly; c += monthly; }
  return pts;
}

// FIX MOBILE: aggiunta prop isMobile
const Simulator: React.FC<{ netWorth: number; defaultContrib: number; defaultRate: number; hidden: boolean; isMobile: boolean }> = ({ netWorth, defaultContrib, defaultRate, hidden, isMobile }) => {
  const [monthly, setMonthly] = useState(Math.max(Math.round(defaultContrib), 0));
  const [pct,     setPct]     = useState(+(defaultRate * 100).toFixed(1) || 6);
  const [years,   setYears]   = useState(10);
  const [useBase, setUseBase] = useState(true);

  const capital = useBase ? netWorth : 0;
  const result  = useMemo(() => runSim(capital, monthly, pct / 100, years), [capital, monthly, pct, years]);
  const pts     = useMemo(() => simPath(capital, monthly, pct / 100, years), [capital, monthly, pct, years]);

  const W = 1000, H = 160, PL = 55, PR = 12, PT = 10, PB = 22;
  const maxY = Math.max(...pts.map(p => p.w), 1);
  const sxP = (m: number) => PL + (m / (years * 12)) * (W - PL - PR);
  const sy  = (v: number) => PT + (1 - v / maxY) * (H - PT - PB);
  const wPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sxP(p.m)} ${sy(p.w)}`).join(' ');
  const cPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sxP(p.m)} ${sy(p.c)}`).join(' ');
  const wArea = `${wPath} L ${sxP(years * 12)} ${sy(0)} L ${PL} ${sy(0)} Z`;

  const Slider = ({ label, val, min, max, step, fmt, onChange }: any) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>{fmt(val)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--foreground)', height: 4, cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* FIX MOBILE: layout a colonna singola su mobile, due colonne su desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: isMobile ? '1.25rem' : '2rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <Slider label="Monthly savings" val={monthly} min={0} max={5000} step={50}  fmt={(v: number) => `€${v.toLocaleString()}`} onChange={setMonthly} />
          <Slider label="Annual return"   val={pct}     min={0} max={15}   step={0.5} fmt={(v: number) => `${v.toFixed(1)}%`}        onChange={setPct} />
          <Slider label="Horizon"         val={years}   min={1} max={40}   step={1}   fmt={(v: number) => `${v} years`}               onChange={setYears} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
            <div onClick={() => setUseBase(v => !v)} style={{ width: 34, height: 18, borderRadius: 999, background: useBase ? 'var(--foreground)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: useBase ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: useBase ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left .2s' }} />
            </div>
            Start from current net worth ({hidden ? '€••••••' : fmtEurCompact(netWorth)})
          </label>
        </div>

        {/* FIX MOBILE: 1 colonna su mobile, 3 colonne su desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1px', background: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {[
            { label: 'Final wealth',      value: fmtOrHide(result.finalWealth,        hidden, true), color: '#30a46c' },
            { label: 'Total gains',       value: fmtOrHide(result.totalGains,         hidden, true), color: 'var(--foreground)' },
            { label: 'Total contributed', value: fmtOrHide(result.totalContributions, hidden, true), color: 'var(--muted-foreground)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--card)', padding: '0.9rem 1rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
              <p style={{ fontSize: '1.15rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.03em' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 160, overflow: 'visible' }}>
        <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30a46c" stopOpacity=".15"/><stop offset="100%" stopColor="#30a46c" stopOpacity="0"/></linearGradient></defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = sy(maxY * f);
          const lbl = hidden ? '•••' : maxY * f >= 1_000_000 ? `€${((maxY * f) / 1_000_000).toFixed(1)}M` : maxY * f >= 1_000 ? `€${((maxY * f) / 1_000).toFixed(0)}k` : `€${Math.round(maxY * f)}`;
          return (
            <g key={f}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth=".5" strokeDasharray="3,3" />
              <text x={PL - 5} y={y + 3} textAnchor="end" fontSize="9" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{lbl}</text>
            </g>
          );
        })}
        <path d={wArea} fill="url(#sg)" />
        <path d={cPath} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="5,4" />
        <path d={wPath} fill="none" stroke="#30a46c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {Array.from({ length: years + 1 }, (_, i) => {
          if (i % Math.max(1, Math.floor(years / 5)) !== 0) return null;
          return <text key={i} x={sxP(i * 12)} y={H - 5} textAnchor="middle" fontSize="8.5" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{addMonths(new Date(), i * 12).getFullYear()}</text>;
        })}
        {(() => { const lp = pts[pts.length - 1]; return <circle cx={sxP(lp.m)} cy={sy(lp.w)} r={5} fill="#30a46c" stroke="var(--background)" strokeWidth="2" />; })()}
      </svg>
    </div>
  );
};

// ── Settings Modal ────────────────────────────────────────────────────────────
const SettingsModal: React.FC<{
  initial: FireSettings; onSave: (s: FireSettings) => Promise<void>;
  onClose: () => void; saving: boolean;
  isBalanceHidden: boolean; onToggleBalanceHidden: () => void;
}> = ({ initial, onSave, onClose, saving, isBalanceHidden, onToggleBalanceHidden }) => {
  const [form, setForm] = useState<FireSettings>({ ...initial });
  const set = (k: keyof FireSettings, v: any) => setForm(f => ({ ...f, [k]: v }));

  const Field = ({ label, fk, hint, pct, noPrefix }: { label: string; fk: keyof FireSettings; hint?: string; pct?: boolean; noPrefix?: boolean }) => {
    const raw = form[fk] as number | null;
    const display = pct && raw != null ? (raw * 100).toFixed(1) : (raw ?? '');
    return (
      <div>
        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
        {hint && <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '-0.05rem 0 0.3rem' }}>{hint}</p>}
        <div style={{ position: 'relative' }}>
          {!noPrefix && <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '0.8rem', fontWeight: 600 }}>{pct ? '%' : '€'}</span>}
          <input
            type="number" step={pct ? 0.5 : 50} value={display as any}
            onChange={e => { if (!e.target.value) { set(fk, null); return; } const v = parseFloat(e.target.value); set(fk, pct ? v / 100 : v); }}
            style={{ width: '100%', padding: noPrefix ? '0.55rem 0.7rem' : '0.55rem 0.7rem 0.55rem 1.65rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '9px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', borderRadius: '18px', border: '1px solid var(--border)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Settings size={14} color="var(--muted-foreground)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>FIRE Settings</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 3, borderRadius: 6 }}><X size={15} /></button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Display</p>
            <div onClick={onToggleBalanceHidden} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.7rem 0.9rem', background: 'var(--accent)', borderRadius: '10px', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
              <div style={{ width: 28, height: 28, borderRadius: '8px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                {isBalanceHidden ? '👁️' : '🙈'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>Hide balances</p>
                <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{isBalanceHidden ? 'Active across the app' : 'Tap to activate'}</p>
              </div>
              <div style={{ width: 34, height: 19, borderRadius: 999, background: isBalanceHidden ? 'var(--foreground)' : 'var(--border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2.5, left: isBalanceHidden ? 'calc(100% - 16.5px)' : '2.5px', width: 14, height: 14, borderRadius: '50%', background: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left .2s' }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Parameters</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Field label="Monthly target spending"   fk="monthly_expenses"        hint="Leave empty → 12-month budget average" />
              <Field label="Monthly net income"        fk="monthly_income_override"  hint="Leave empty → budget average" />
              <Field label="INPS unemployment benefit" fk="inps_monthly" />
              <Field label="FIRE Number (optional)"    fk="fire_number"  hint="Empty → expenses × 12 × 25" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Annual return %" fk="annual_return_rate" pct />
                <Field label="Inflation %"     fk="inflation_rate"     pct />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Current age"     fk="current_age"     noPrefix />
                <Field label="Target FIRE age" fk="target_fire_age" noPrefix />
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'var(--muted)', border: 'none', borderRadius: '9px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
          <button onClick={() => onSave(form).then(onClose)} disabled={saving} style={{ padding: '0.5rem 1.25rem', background: 'var(--foreground)', border: 'none', borderRadius: '9px', fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--background)', fontFamily: 'var(--font-sans)', opacity: saving ? .6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const FirePage: React.FC = () => {
  const { data, loading, error, saving, refresh, saveSettings } = useFire();
  const { isBalanceHidden, toggleBalanceVisibility } = useBalancePrivacy();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab,    setActiveTab]    = useState<'overview' | 'simulation' | 'scenarios'>('overview');
  const isMobile = useIsMobile();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 26, height: 26, border: '2.5px solid var(--foreground)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
  if (error || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: 'var(--destructive)', fontWeight: 600 }}>Failed to load FIRE data</p>
      <button onClick={refresh} style={{ padding: '8px 20px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '9px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const s              = data.settings;
  const fireNum        = s.fire_number ?? data.avg_monthly_expenses * 12 * 25;
  const firePct        = Math.min((data.net_worth / fireNum) * 100, 100);
  const passiveMonthly = data.net_worth * s.annual_return_rate / 12;
  const coverageRatio  = data.avg_monthly_expenses > 0 ? (passiveMonthly / data.avg_monthly_expenses) * 100 : 0;
  const timeToFire     = data.fire_scenarios[1];

  const isCoastFire = (() => {
    if (!s.current_age || !s.target_fire_age) return false;
    const yrs = s.target_fire_age - s.current_age;
    return yrs > 0 && data.net_worth * Math.pow(1 + s.annual_return_rate, yrs) >= fireNum;
  })();

  const TABS: [typeof activeTab, string, string][] = [
    ['overview',   'Overview',       'Overview'],
    ['simulation', '💡 Simulator',   'Simulator'],
    ['scenarios',  'FIRE Scenarios', 'Scenarios'],
  ];

  const statBar = [
    { label: 'Net Worth',       value: fmtOrHide(data.net_worth,            isBalanceHidden, true), color: 'var(--foreground)' },
    { label: 'Monthly Savings', value: fmtOrHide(data.avg_monthly_savings,  isBalanceHidden, true), color: data.avg_monthly_savings >= 0 ? '#30a46c' : '#e5484d' },
    { label: 'Savings Rate',    value: isBalanceHidden ? '••.•%' : `${data.savings_rate.toFixed(1)}%`, color: data.savings_rate >= 20 ? '#30a46c' : 'var(--color-orange-400)' },
    { label: 'Freedom Score',   value: isBalanceHidden ? '••%' : `${firePct.toFixed(1)}%`, color: firePct >= 100 ? '#30a46c' : firePct >= 50 ? 'var(--color-orange-400)' : 'var(--foreground)' },
    { label: 'Time to FIRE',    value: timeToFire?.years_to_fire != null ? `${timeToFire.years_to_fire.toFixed(1)} yrs` : '—', color: 'var(--foreground)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'color-mix(in srgb, var(--background) 90%, transparent)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div style={{ padding: `0 ${isMobile ? '1rem' : '2rem'}`, height: 48, display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <Flame size={15} color="#f97316" />
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>FIRE</span>
          </div>

          {/* FIX MOBILE: overflow hidden + flexShrink per non tagliare i tab */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px', overflow: 'hidden', flexShrink: 1, minWidth: 0 }}>
            {TABS.map(([key, labelFull, labelShort]) => {
              const active = activeTab === key;
              return (
                <span key={key} onClick={() => setActiveTab(key)} style={{
                  // FIX MOBILE: padding e font ridotti su mobile
                  fontSize: isMobile ? '0.72rem' : '0.78rem',
                  fontWeight: active ? 700 : 500,
                  padding: isMobile ? '4px 8px' : '4px 12px',
                  borderRadius: '8px', cursor: 'pointer',
                  background: active ? 'var(--muted)' : 'transparent',
                  color:      active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  boxShadow:  active ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
                  transition: 'all .15s', whiteSpace: 'nowrap',
                  WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                  flexShrink: 0,
                }}>
                  {isMobile ? labelShort : labelFull}
                </span>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          {/* Snapshot label (desktop only) */}
          {!isMobile && (
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>
              {NOW_LABEL}
            </span>
          )}

          {/* Eye */}
          <button onClick={toggleBalanceVisibility}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', color: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)', border: 'none', borderRadius: '9px', cursor: 'pointer', flexShrink: 0, transition: 'all .15s' }}>
            {isBalanceHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>

          {/* Settings */}
          <button onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 12px', height: 32, background: 'var(--muted)', color: 'var(--muted-foreground)', border: 'none', borderRadius: '9px', cursor: 'pointer', flexShrink: 0, fontSize: '0.78rem', fontWeight: 600, transition: 'all .15s' }}>
            <Settings size={13} />
            {!isMobile && 'Settings'}
          </button>
        </div>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(180deg, color-mix(in srgb, #30a46c 6%, var(--background)) 0%, var(--background) 80%)`, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>

        <div style={{ padding: isMobile ? '1.25rem 1rem 0.75rem' : '1.5rem 2rem 0.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 4px' }}>Net Worth</p>
            <p style={{ fontSize: isMobile ? '2.4rem' : '2.8rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 6px', color: 'var(--foreground)' }}>
              {isBalanceHidden ? '€••••••' : (() => {
                const n = data.net_worth;
                const int = Math.floor(n).toLocaleString('en-US');
                const dec = (n % 1).toFixed(2).slice(1);
                return <>{int}<span style={{ fontSize: '55%', fontWeight: 700, color: 'var(--muted-foreground)' }}>{dec}</span></>;
              })()}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: firePct >= 100 ? '#30a46c' : 'var(--color-orange-400)' }}>
                {isBalanceHidden ? '••.•%' : `${firePct.toFixed(1)}%`} to FIRE
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                {isBalanceHidden ? '€••••••' : fmtEurCompact(passiveMonthly)}/mo passive
              </span>
              {isCoastFire && <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, #30a46c 12%, var(--background))', color: '#30a46c', border: '1px solid color-mix(in srgb, #30a46c 25%, transparent)' }}>🏖️ Coast FIRE</span>}
            </div>
          </div>

          {!isMobile && (
            <div style={{ width: 340, paddingTop: '0.5rem' }}>
              <FireProgress netWorth={data.net_worth} fireNumber={fireNum} hidden={isBalanceHidden} />
            </div>
          )}
        </div>

        <div style={{ padding: isMobile ? '0 1rem' : '0 2rem' }}>
          {isMobile && <div style={{ marginBottom: '0.75rem' }}><FireProgress netWorth={data.net_worth} fireNumber={fireNum} hidden={isBalanceHidden} /></div>}
          <HeroChart history={data.net_worth_history} hidden={isBalanceHidden} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${statBar.length}, 1fr)`, borderTop: '1px solid var(--border)', marginTop: '0.75rem' }}>
          {statBar.map(({ label, value, color }, idx) => (
            <div key={label} style={{ padding: isMobile ? '0.9rem 1rem' : '1rem 1.5rem', borderRight: idx < statBar.length - 1 ? '1px solid var(--border)' : 'none', ...(isMobile && idx === 4 ? { gridColumn: 'span 2', borderRight: 'none' } : {}) }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color, letterSpacing: '-0.02em' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div style={{ padding: isMobile ? `1.25rem 1rem calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` : '2rem 2rem 3rem' }}>

        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: '2rem', alignItems: 'start' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

              <section>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Capital Depletion</h2>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>How long your wealth lasts without working</span>
                </div>
                <DepletionChart netWorth={data.net_worth} monthlyExpenses={data.avg_monthly_expenses} annualReturn={s.annual_return_rate} hidden={isBalanceHidden} />
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                {[
                  { label: 'Avg Income / mo',  value: fmtOrHide(data.avg_monthly_income,   isBalanceHidden, true), color: '#30a46c',                      icon: <TrendingUp size={13} /> },
                  { label: 'Avg Expenses / mo', value: fmtOrHide(data.avg_monthly_expenses, isBalanceHidden, true), color: '#e5484d',                      icon: <Activity size={13} /> },
                  { label: 'Passive / mo',      value: fmtOrHide(passiveMonthly,            isBalanceHidden, true), color: 'var(--color-orange-400)',       icon: <Zap size={13} /> },
                  { label: 'Coverage',          value: isBalanceHidden ? '••%' : `${coverageRatio.toFixed(0)}%`, color: coverageRatio >= 100 ? '#30a46c' : 'var(--color-orange-400)', icon: <Target size={13} /> },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} style={{ background: 'var(--card)', padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color, letterSpacing: '-0.02em' }}>{value}</p>
                    </div>
                    <div style={{ color, opacity: .7 }}>{icon}</div>
                  </div>
                ))}
              </div>

              <div onClick={() => setActiveTab('simulation')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'color-mix(in srgb, #f97316 12%, var(--background))', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={14} /></div>
                  <div>
                    <p style={{ fontSize: '0.83rem', fontWeight: 700, margin: 0 }}>What-if Simulator</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Project wealth growth with adjustable savings, return rate and time horizon</p>
                  </div>
                </div>
                <ArrowRight size={15} color="var(--muted-foreground)" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              <section>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Runway</h2>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Without working</span>
                </div>
                <p style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 4px', color: 'var(--foreground)' }}>
                  {fmtYears(data.runway_scenarios[0]?.months ?? 0)}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: '0 0 1.25rem' }}>
                  capital only · {fmtOrHide(data.avg_monthly_expenses, isBalanceHidden, true)}/mo avg
                </p>
                {(() => {
                  const maxM = Math.max(...data.runway_scenarios.filter(s => s.months < 9990).map(s => s.months), 60);
                  const colors = ['var(--color-blue-600)', 'var(--color-orange-400)', '#30a46c'];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {data.runway_scenarios.map((s, i) => <RunwayRow key={s.label} label={s.label} months={s.months} description={s.description} color={colors[i]} maxMonths={maxM} />)}
                    </div>
                  );
                })()}
              </section>

              <div style={{ height: 1, background: 'var(--border)' }} />

              <section>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>FIRE Scenarios</h2>
                  <span onClick={() => setActiveTab('scenarios')} style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', cursor: 'pointer' }}>View all →</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  {data.fire_scenarios.map((sc, i) => {
                    const colors = ['var(--color-blue-600)', 'var(--color-orange-400)', '#30a46c'];
                    const icons  = [<Zap size={12} />, <Flame size={12} />, <Shield size={12} />];
                    const c = colors[i];
                    return (
                      <div key={sc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', background: 'var(--card)', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 24, height: 24, borderRadius: 7, background: `color-mix(in srgb, ${c} 12%, var(--background))`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons[i]}</div>
                          <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>{sc.label}</p>
                            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{fmtOrHide(sc.monthly_target, isBalanceHidden, true)}/mo · {fmtOrHide(sc.fire_number, isBalanceHidden, true)}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: sc.months_to_fire === 0 ? '#30a46c' : 'var(--foreground)' }}>
                            {sc.months_to_fire === 0 ? '🎉 Done!' : sc.years_to_fire != null ? `${sc.years_to_fire.toFixed(1)} yrs` : '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  <BarChart2 size={13} /> Adjust income, expenses &amp; return rate
                </div>
                <Settings size={13} color="var(--muted-foreground)" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'simulation' && (
          <section>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px' }}>What-if Simulator</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>Adjust the sliders to project your wealth growth over time</p>
            </div>
            {/* FIX MOBILE: passa isMobile al Simulator */}
            <Simulator netWorth={data.net_worth} defaultContrib={data.avg_monthly_savings} defaultRate={s.annual_return_rate} hidden={isBalanceHidden} isMobile={isMobile} />
          </section>
        )}

        {activeTab === 'scenarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
              {data.fire_scenarios.map((sc, i) => {
                const colors = ['var(--color-blue-600)', 'var(--color-orange-400)', '#30a46c'];
                const icons  = [<Zap size={14} />, <Flame size={14} />, <Shield size={14} />];
                const c = colors[i]; const isTarget = i === 1;
                return (
                  <div key={sc.label} style={{ background: 'var(--card)', padding: '1.5rem', borderLeft: isTarget ? `3px solid ${c}` : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.1rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${c} 12%, var(--background))`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons[i]}</div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{sc.label}</span>
                      {isTarget && <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `color-mix(in srgb, ${c} 12%, var(--background))`, color: c }}>Target</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {[
                        { label: 'Monthly spending', value: fmtOrHide(sc.monthly_target, isBalanceHidden) },
                        { label: 'FIRE number',       value: fmtOrHide(sc.fire_number,    isBalanceHidden), color: c },
                        { label: 'Time to FIRE',      value: sc.months_to_fire === 0 ? '🎉 Achieved!' : sc.years_to_fire != null ? `${sc.years_to_fire.toFixed(1)} years` : '—', large: true },
                      ].map(({ label, value, color, large }: any) => (
                        <div key={label}>
                          <p style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                          <p style={{ fontSize: large ? '1.5rem' : '0.95rem', fontWeight: large ? 900 : 700, margin: 0, color: color ?? 'var(--foreground)', letterSpacing: large ? '-0.04em' : '-0.02em', lineHeight: 1 }}>{value}</p>
                          {sc.months_to_fire !== null && sc.months_to_fire > 0 && large && (
                            <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{Math.round(sc.months_to_fire)} months</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <section>
              <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Data sources</h2>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                {[
                  { label: '12-mo avg income',  value: fmtOrHide(data.avg_monthly_income,   isBalanceHidden, true) },
                  { label: '12-mo avg expenses', value: fmtOrHide(data.avg_monthly_expenses, isBalanceHidden, true) },
                  { label: 'Avg net savings',    value: fmtOrHide(data.avg_monthly_savings,  isBalanceHidden, true) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--card)', padding: '1rem 1.25rem' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                    <p style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>{value}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>per month</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal initial={data.settings} onSave={saveSettings} onClose={() => setShowSettings(false)}
          saving={saving} isBalanceHidden={isBalanceHidden} onToggleBalanceHidden={toggleBalanceVisibility} />
      )}
    </div>
  );
};
