// src/pages/fire/index.tsx
import { useBalancePrivacy } from '@/hooks/use-balance-privacy';
import { FireSettings, useFire } from '@/hooks/useFire';
import {
  Activity, ArrowRight,
  Eye, EyeOff, Flame,
  Home, Play, Settings, Shield, Target, TrendingUp, Wallet, X, Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

// ─── helpers ──────────────────────────────────────────────────────────────────
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
  hidden ? '€••••••' : compact ? fmtEurCompact(n) : fmtEurFull(n);

const fmtYears = (months: number) =>
  months >= 9990 ? '∞' : months >= 24 ? `${(months / 12).toFixed(1)} yrs` : `${Math.round(months)} mo`;

function addMonths(d: Date, n: number) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }

// ─── Chart sparkline — investments-page style ─────────────────────────────────
type Period = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
const PERIODS: Period[] = ['1M', '3M', '6M', 'YTD', '1Y', 'ALL'];
const PERIOD_LABEL: Record<Period, string> = {
  '1M': 'past month', '3M': 'past 3 months', '6M': 'past 6 months',
  'YTD': 'year to date', '1Y': 'past year', 'ALL': 'all time',
};

function filterByPeriod(history: { date: string; total_value: number }[], period: Period) {
  const now = new Date();
  const from: Record<Period, Date> = {
    '1M':  new Date(now.getFullYear(), now.getMonth() - 1,  now.getDate()),
    '3M':  new Date(now.getFullYear(), now.getMonth() - 3,  now.getDate()),
    '6M':  new Date(now.getFullYear(), now.getMonth() - 6,  now.getDate()),
    'YTD': new Date(now.getFullYear(), 0, 1),
    '1Y':  new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
    'ALL': new Date(2000, 0, 1),
  };
  const cutoff = from[period];
  return history.filter(p => new Date(p.date) >= cutoff);
}

const HeroChart: React.FC<{ history: { date: string; total_value: number }[]; hidden: boolean }> = ({ history, hidden }) => {
  const [period, setPeriod] = useState<Period>('ALL');
  const [hover, setHover] = useState<{ x: number; val: number; date: string } | null>(null);
  const isMobile = useIsMobile();

  const sorted = useMemo(() => {
    const filtered = filterByPeriod([...history].sort((a, b) => a.date.localeCompare(b.date)), period);
    return filtered.length > 1 ? filtered : [...history].sort((a, b) => a.date.localeCompare(b.date));
  }, [history, period]);

  const vals    = sorted.map(p => p.total_value);
  const first   = vals[0] ?? 0;
  const last    = vals[vals.length - 1] ?? 0;
  const change  = last - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const isPos   = change >= 0;

  const minV = Math.min(...vals), maxV = Math.max(...vals), rng = maxV - minV || 1;
  const W = 1000, H = 200, PT = 8, PB = 0;
  const sx = (i: number) => (i / Math.max(sorted.length - 1, 1)) * W;
  const sy = (v: number) => PT + (1 - (v - minV) / rng) * (H - PT - PB);

  const pts   = sorted.map((p, i) => ({ x: sx(i), y: sy(p.total_value), val: p.total_value, date: p.date }));
  const line  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area  = `${line} L ${W} ${H} L 0 ${H} Z`;
  const color = '#30a46c';
  const chartH = isMobile ? 180 : 260;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(xRatio * (sorted.length - 1));
    const c = Math.max(0, Math.min(sorted.length - 1, idx));
    setHover({ x: pts[c].x / W * 100, val: pts[c].val, date: sorted[c].date });
  };

  // x-axis ticks
  const tickCount = isMobile ? 3 : 5;
  const tickIdxs = Array.from({ length: tickCount }, (_, i) => Math.round((i / (tickCount - 1)) * (sorted.length - 1)));

  return (
    <div>
      {/* Amount row */}
      <div style={{ padding: isMobile ? '1rem 1rem 0' : '1.25rem 1.5rem 0' }}>
        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '0 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Net Worth</p>
        <p style={{ fontSize: isMobile ? '2.4rem' : '3rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 0.4rem', color: 'var(--foreground)' }}>
          {hidden ? '€••••••' : (() => {
            const int = Math.floor(last).toLocaleString('en-US');
            const dec = (last % 1).toFixed(2).slice(1);
            return <>{int}<span style={{ fontSize: '55%', fontWeight: 700, color: 'var(--muted-foreground)' }}>{dec}</span></>;
          })()}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isPos ? '#30a46c' : '#e5484d' }}>
            {hidden ? '€••••••' : `${isPos ? '+' : ''}${fmtEurCompact(Math.abs(change))}`}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isPos ? '#30a46c' : '#e5484d' }}>
            {hidden ? '••.•%' : `${isPos ? '+' : ''}${changePct.toFixed(2)}%`}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>{PERIOD_LABEL[period]}</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative', width: '100%', height: chartH, marginTop: '0.75rem' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity=".2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#fireGrad)" />
          <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {hover && (
            <>
              <line x1={hover.x / 100 * W} y1={PT} x2={hover.x / 100 * W} y2={H} stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity=".5" />
              <circle cx={hover.x / 100 * W} cy={sy(hover.val)} r={5} fill={color} stroke="white" strokeWidth="2" />
            </>
          )}
        </svg>

        {hover && (
          <div style={{
            position: 'absolute', top: 8,
            left: `clamp(0px, calc(${hover.x}% - 70px), calc(100% - 145px))`,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '6px 12px', pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: '0.75rem', whiteSpace: 'nowrap',
          }}>
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 500, marginRight: 8 }}>
              {new Date(hover.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span style={{ color, fontWeight: 700 }}>{hidden ? '€••••••' : fmtEurFull(hover.val)}</span>
          </div>
        )}
      </div>

      {/* X-axis ticks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: `2px ${isMobile ? '0' : '0'} 0` }}>
        {tickIdxs.map(i => (
          <span key={i} style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
            {new Date(sorted[i]?.date ?? '').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
          </span>
        ))}
      </div>

      {/* Period selector */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 2,
        padding: isMobile ? '0.5rem 0' : '0.5rem 0',
        borderTop: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
        marginTop: '0.5rem',
        overflowX: 'auto',
      }}>
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: isMobile ? '4px 9px' : '5px 12px',
            fontSize: '0.75rem', fontWeight: period === p ? 700 : 500,
            borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            background: period === p ? 'var(--foreground)' : 'transparent',
            color:      period === p ? 'var(--background)' : 'var(--muted-foreground)',
            WebkitTapHighlightColor: 'transparent', flexShrink: 0,
          }}>{p}</button>
        ))}
      </div>
    </div>
  );
};

// ─── FIRE progress ────────────────────────────────────────────────────────────
const FireProgress: React.FC<{ netWorth: number; fireNumber: number; hidden: boolean }> = ({ netWorth, fireNumber, hidden }) => {
  const pct = Math.min((netWorth / fireNumber) * 100, 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FIRE Progress</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: pct >= 100 ? '#30a46c' : 'var(--foreground)' }}>{hidden ? '••.•%' : `${pct.toFixed(1)}%`}</span>
      </div>
      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: pct >= 100 ? '#30a46c' : 'linear-gradient(90deg, #f97316, #30a46c)', transition: 'width 1.2s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)' }}>{hidden ? '€••••••' : fmtEurCompact(netWorth)} saved</span>
        <span style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)' }}>Goal {hidden ? '€••••••' : fmtEurCompact(fireNumber)}</span>
      </div>
    </div>
  );
};

// ─── Depletion chart — horizontal timeline strip ──────────────────────────────
const DepletionChart: React.FC<{ netWorth: number; monthlyExpenses: number; annualReturn: number; hidden: boolean }> = ({ netWorth, monthlyExpenses, annualReturn, hidden }) => {
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const { mCap, mRet, dCap, dRet } = useMemo(() => {
    const r = annualReturn / 12;
    let cap = netWorth, ret = netWorth, mCap = 0, mRet = 0;
    for (let m = 1; m <= 9999; m++) {
      cap -= monthlyExpenses;
      ret  = ret * (1 + r) - monthlyExpenses;
      if (cap <= 0 && mCap === 0) mCap = m;
      if (ret <= 0 && mRet === 0) mRet = m;
      if (mCap > 0 && mRet > 0) break;
    }
    // if never depletes (returns cover expenses), cap at 9999
    if (mCap === 0) mCap = 9999;
    if (mRet === 0) mRet = 9999;
    return {
      mCap, mRet,
      dCap: addMonths(new Date(), mCap),
      dRet: addMonths(new Date(), mRet),
    };
  }, [netWorth, monthlyExpenses, annualReturn]);

  const maxM = Math.min(Math.max(mCap, mRet) + Math.round(Math.max(mCap, mRet) * 0.12), 9999);
  const isInfinite = (m: number) => m >= 9999;

  // which month is the cursor hovering over
  const hoverMonth = hoverPct != null ? Math.round((hoverPct / 100) * maxM) : null;
  const hoverDate  = hoverMonth != null ? addMonths(new Date(), hoverMonth) : null;

  const dateFmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const fmtMo = (m: number) => m >= 9999 ? '∞' : m >= 24 ? `${(m / 12).toFixed(1)} yrs` : `${m} mo`;

  // tick marks — every N months
  const tickStep = maxM <= 24 ? 3 : maxM <= 60 ? 6 : maxM <= 120 ? 12 : 24;
  const ticks = Array.from({ length: Math.floor(maxM / tickStep) }, (_, i) => (i + 1) * tickStep).filter(t => t < maxM);

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem' }}>
        {[
          { label: 'Capital only',     value: isInfinite(mCap) ? '∞' : fmtMo(mCap), sub: isInfinite(mCap) ? 'self-sustaining' : `depletes ${dateFmt(dCap)}`, color: '#e5484d', bg: 'color-mix(in srgb, #e5484d 8%, var(--background))' },
          { label: 'With returns',     value: isInfinite(mRet) ? '∞' : fmtMo(mRet), sub: isInfinite(mRet) ? 'self-sustaining' : `depletes ${dateFmt(dRet)}`, color: '#30a46c', bg: 'color-mix(in srgb, #30a46c 8%, var(--background))' },
          { label: 'Monthly expenses', value: hidden ? '€••••••' : fmtEurCompact(monthlyExpenses), sub: 'avg spending', color: 'var(--foreground)', bg: 'var(--card)' },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} style={{ background: bg, padding: '0.9rem 1rem' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color, margin: '0 0 2px', letterSpacing: '-0.035em', lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Timeline strip */}
      <div
        style={{ position: 'relative', userSelect: 'none' }}
        onMouseLeave={() => setHoverPct(null)}
        onMouseMove={e => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setHoverPct(((e.clientX - rect.left) / rect.width) * 100);
        }}
      >
        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 28 }}>
          {[
            { label: 'Capital only', months: mCap, color: '#e5484d', endDate: dCap },
            { label: 'With returns', months: mRet, color: '#30a46c', endDate: dRet },
          ].map(({ label, months, color, endDate }) => {
            const inf  = isInfinite(months);
            const pct  = inf ? 100 : Math.min((months / maxM) * 100, 100);
            const endPct = pct;
            return (
              <div key={label}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color }}>{inf ? '∞ — self-sustaining' : dateFmt(endDate)}</span>
                </div>
                {/* Track */}
                <div style={{ position: 'relative', height: 10, background: 'var(--muted)', borderRadius: 999, overflow: 'visible' }}>
                  {/* Fill */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 999,
                    opacity: 0.85,
                  }} />
                  {/* End marker dot */}
                  {!inf && (
                    <div style={{
                      position: 'absolute', top: '50%', left: `${endPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 14, height: 14, borderRadius: '50%',
                      background: color, border: '2.5px solid var(--background)',
                      boxShadow: `0 0 0 1.5px ${color}`,
                      zIndex: 2,
                    }} />
                  )}
                  {/* Hover cursor line */}
                  {hoverPct != null && (
                    <div style={{
                      position: 'absolute', top: -4, left: `${hoverPct}%`,
                      transform: 'translateX(-50%)',
                      width: 1.5, height: 18,
                      background: 'var(--muted-foreground)',
                      opacity: 0.4,
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis ticks */}
        <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', pointerEvents: 'none' }}>
          <div style={{ position: 'relative', width: '100%', height: 18 }}>
            <span style={{ position: 'absolute', left: 0, fontSize: '0.65rem', color: 'var(--muted-foreground)', transform: 'translateX(0)' }}>now</span>
            {ticks.map(t => (
              <span key={t} style={{ position: 'absolute', left: `${(t / maxM) * 100}%`, fontSize: '0.65rem', color: 'var(--muted-foreground)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                {t >= 12 && t % 12 === 0 ? `${t / 12}y` : `${t}mo`}
              </span>
            ))}
          </div>
        </div>

        {/* Hover tooltip */}
        {hoverPct != null && hoverDate != null && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% - 10px)',
            left: `clamp(0px, calc(${hoverPct}% - 60px), calc(100% - 130px))`,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 10px', pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,.1)', fontSize: '0.7rem', whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {dateFmt(hoverDate)}
            </span>
            <span style={{ marginLeft: 6, color: 'var(--muted-foreground)' }}>
              · month {hoverMonth}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Runway row ───────────────────────────────────────────────────────────────
const RunwayRow: React.FC<{ label: string; months: number; color: string; maxMonths: number }> = ({ label, months, color, maxMonths }) => {
  const isInf = months >= 9990;
  const pct   = isInf ? 100 : Math.min((months / maxMonths) * 100, 100);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 68px', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '0.77rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ background: 'var(--muted)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color, transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, textAlign: 'right' }}>{isInf ? '∞' : fmtYears(months)}</span>
    </div>
  );
};

// ─── Simulator ────────────────────────────────────────────────────────────────
function runSim(capital: number, monthly: number, rate: number, years: number) {
  const r = rate / 12, months = years * 12;
  let w = capital;
  for (let i = 0; i < months; i++) w = w * (1 + r) + monthly;
  return { finalWealth: w, totalContributions: capital + monthly * months, totalGains: w - (capital + monthly * months) };
}

function simPath(capital: number, monthly: number, rate: number, years: number) {
  const r = rate / 12, months = years * 12;
  const pts: { m: number; w: number; c: number }[] = [];
  let w = capital, c = capital;
  for (let m = 0; m <= months; m++) { pts.push({ m, w, c }); w = w * (1 + r) + monthly; c += monthly; }
  return pts;
}

const SliderField: React.FC<{ label: string; val: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }> = ({ label, val, min, max, step, fmt, onChange }) => {
  const pct = ((val - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{fmt(val)}</span>
      </div>
      <div style={{ position: 'relative', height: 20 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 5, borderRadius: 999, background: 'var(--muted)' }} />
        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: 5, borderRadius: 999, width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-orange-400), #30a46c)' }} />
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 20, margin: 0 }}
        />
        <div style={{
          position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
          left: `${pct}%`, width: 18, height: 18, borderRadius: '50%',
          background: 'var(--foreground)', border: '2px solid var(--background)',
          boxShadow: '0 0 0 1.5px var(--border), 0 2px 8px rgba(0,0,0,.2)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
};

const Simulator: React.FC<{ netWorth: number; defaultContrib: number; defaultRate: number; hidden: boolean; isMobile: boolean }> = ({ netWorth, defaultContrib, defaultRate, hidden, isMobile }) => {
  const [monthly, setMonthly] = useState(Math.max(Math.round(defaultContrib), 0));
  const [pct,     setPct]     = useState(+(defaultRate * 100).toFixed(1) || 6);
  const [years,   setYears]   = useState(10);
  const [useBase, setUseBase] = useState(true);
  const capital = useBase ? netWorth : 0;
  const result  = useMemo(() => runSim(capital, monthly, pct / 100, years), [capital, monthly, pct, years]);
  const pts     = useMemo(() => simPath(capital, monthly, pct / 100, years), [capital, monthly, pct, years]);

  const W = 1000, H = 260, PT = 10, PB = 28;
  const maxY = Math.max(...pts.map(p => p.w), 1);
  const sxP  = (m: number) => (m / (years * 12)) * W;
  const sy   = (v: number) => PT + (1 - v / maxY) * (H - PT - PB);
  const wPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sxP(p.m)} ${sy(p.w)}`).join(' ');
  const cPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sxP(p.m)} ${sy(p.c)}`).join(' ');
  const wArea = `${wPath} L ${sxP(years * 12)} ${sy(0)} L 0 ${sy(0)} Z`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {[
          { label: 'Final Wealth',      value: fmtOrHide(result.finalWealth,        hidden, true), sub: `in ${years} years`,  color: '#30a46c' },
          { label: 'Investment Gains',  value: fmtOrHide(result.totalGains,         hidden, true), sub: 'from returns',        color: 'var(--foreground)' },
          { label: 'Total Contributed', value: fmtOrHide(result.totalContributions, hidden, true), sub: 'your savings',        color: 'var(--muted-foreground)' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: 'var(--card)', padding: '1.1rem 1.25rem' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 900, color, margin: '0 0 2px', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Controls + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: isMobile ? '1.5rem' : '2rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <SliderField label="Monthly savings" val={monthly} min={0} max={5000} step={50} fmt={v => `€${v.toLocaleString()}`} onChange={setMonthly} />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <SliderField label="Annual return" val={pct} min={0} max={15} step={0.5} fmt={v => `${v.toFixed(1)}%`} onChange={setPct} />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <SliderField label="Horizon" val={years} min={1} max={40} step={1} fmt={v => `${v} yrs`} onChange={setYears} />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div onClick={() => setUseBase(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '0.65rem 0.75rem', borderRadius: 10,
            background: useBase ? 'color-mix(in srgb, #30a46c 8%, var(--background))' : 'var(--accent)',
            border: `1px solid ${useBase ? 'color-mix(in srgb, #30a46c 25%, transparent)' : 'var(--border)'}`,
          }}>
            <div style={{ width: 34, height: 19, borderRadius: 999, background: useBase ? '#30a46c' : 'var(--border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2.5, left: useBase ? 'calc(100% - 16.5px)' : '2.5px', width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>Start from net worth</p>
              <p style={{ fontSize: '0.63rem', margin: '1px 0 0', color: 'var(--muted-foreground)' }}>{hidden ? '€••••••' : fmtEurCompact(netWorth)} current</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            {[{ color: '#30a46c', label: 'Projected wealth' }, { color: 'var(--muted-foreground)', label: 'Contributions only', dash: true }].map(({ color, label, dash }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 2.5, borderRadius: 2, background: dash ? 'transparent' : color, borderBottom: dash ? '2px dashed var(--muted-foreground)' : 'none' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ width: '100%', height: isMobile ? 220 : 'clamp(220px, 28vw, 320px)' }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#30a46c" stopOpacity=".18" /><stop offset="100%" stopColor="#30a46c" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={wArea} fill="url(#sg)" />
              <path d={cPath} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="6,5" opacity=".5" />
              <path d={wPath} fill="none" stroke="#30a46c" strokeWidth="2.5" strokeLinecap="round" />
              {Array.from({ length: Math.min(years, 6) + 1 }, (_, i) => {
                const yr = Math.round(i * years / Math.min(years, 6));
                return <text key={i} x={sxP(yr * 12)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">{addMonths(new Date(), yr * 12).getFullYear()}</text>;
              })}
              {(() => { const lp = pts[pts.length - 1]; return <circle cx={sxP(lp.m)} cy={sy(lp.w)} r={5.5} fill="#30a46c" stroke="var(--background)" strokeWidth="2.5" />; })()}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Mortgage Calculator ──────────────────────────────────────────────────────
interface MortgageResult {
  principal: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  totalCosts: number;
  recovery730: number;
  amortization: { m: number; payment: number; interest: number; capital: number; balance: number }[];
}

function calcMortgage(housePrice: number, downPayment: number, annualRate: number, years: number, extraCosts: number): MortgageResult {
  const principal = housePrice - downPayment;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  const monthlyPayment = r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const totalPaid = monthlyPayment * n;
  const totalInterest = totalPaid - principal;
  const totalCosts = downPayment + extraCosts + totalPaid;
  // 730: 19% of interests paid up to €4000/year → max €760/year, for the loan life
  const annualInterestAvg = totalInterest / years;
  const deductiblePerYear = Math.min(annualInterestAvg, 4000);
  const recovery730 = deductiblePerYear * 0.19 * Math.min(years, 20);

  const amortization: MortgageResult['amortization'] = [];
  let balance = principal;
  for (let m = 1; m <= Math.min(n, 360); m++) {
    const interest = balance * r;
    const capital  = monthlyPayment - interest;
    balance -= capital;
    amortization.push({ m, payment: monthlyPayment, interest, capital, balance: Math.max(balance, 0) });
  }
  return { principal, monthlyPayment, totalPaid, totalInterest, totalCosts, recovery730, amortization };
}

const MORTGAGE_YEARS = [10, 15, 20, 25, 30];

const MortgageCalculator: React.FC<{ hidden: boolean; isMobile: boolean }> = ({ hidden, isMobile }) => {
  const [housePrice,   setHousePrice]   = useState(200000);
  const [downPayment,  setDownPayment]  = useState(30000);
  const [annualRate,   setAnnualRate]   = useState(3.18);
  const [years,        setYears]        = useState(25);
  const [agencyFee,    setAgencyFee]    = useState(8000);
  const [notaryFee,    setNotaryFee]    = useState(3000);
  const [bankFee,      setBankFee]      = useState(350);
  const [taxes,        setTaxes]        = useState(4500);
  const [otherCosts,   setOtherCosts]   = useState(10000);

  const extraCosts = agencyFee + notaryFee + bankFee + taxes + otherCosts;
  const result     = useMemo(() => calcMortgage(housePrice, downPayment, annualRate, years, extraCosts), [housePrice, downPayment, annualRate, years, extraCosts]);

  // amortization chart
  const amData = result.amortization.filter((_, i) => i % 6 === 0 || i === result.amortization.length - 1);
  const W = 1000, H = 200, PB = 24;
  const maxBal = result.principal;
  const sx = (i: number) => (i / (result.amortization.length - 1)) * W;
  const sy = (v: number) => (1 - v / maxBal) * (H - PB);
  const balPath  = result.amortization.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.balance)}`).join(' ');
  const intPath  = result.amortization.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.interest * 12)}`).join(' ');
  const balArea  = `${balPath} L ${W} ${sy(0)} L 0 ${sy(0)} Z`;
  const downPct  = housePrice > 0 ? (downPayment / housePrice * 100) : 0;

  const NumInput: React.FC<{ label: string; val: number; onChange: (v: number) => void; prefix?: string; step?: number }> = ({ label, val, onChange, prefix = '€', step = 1000 }) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '0.8rem', fontWeight: 600, pointerEvents: 'none' }}>{prefix}</span>
        <input type="number" value={val} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ width: '100%', padding: `0.5rem 0.7rem 0.5rem ${prefix ? '1.6rem' : '0.7rem'}`, background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 9, fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );

  const fmtH = (n: number) => hidden ? '€••••••' : fmtEurFull(n);
  const fmtHc = (n: number) => hidden ? '€••••••' : fmtEurCompact(n);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {[
          { label: 'Monthly payment',   value: fmtH(result.monthlyPayment),  color: 'var(--foreground)',          sub: `${years} year mortgage` },
          { label: 'Total interest',    value: fmtHc(result.totalInterest),   color: '#e5484d',                    sub: `${result.principal > 0 ? ((result.totalInterest / result.principal) * 100).toFixed(0) : 0}% of loan` },
          { label: 'Total house cost',  value: fmtHc(result.totalCosts),      color: 'var(--foreground)',          sub: 'incl. down + extras' },
          { label: '730 tax recovery',  value: fmtHc(result.recovery730),     color: '#30a46c',                    sub: 'est. over loan life' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: 'var(--card)', padding: '1.1rem 1.25rem' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 900, color, margin: '0 0 2px', letterSpacing: '-0.035em', lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Property</p>
          <NumInput label="House price"   val={housePrice}  onChange={setHousePrice} />
          <NumInput label="Down payment"  val={downPayment} onChange={setDownPayment} />
          <div style={{ padding: '0.5rem 0.75rem', background: 'var(--accent)', borderRadius: 9, fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Down payment</span>
            <strong style={{ color: downPct >= 20 ? '#30a46c' : '#f97316' }}>{downPct.toFixed(1)}%</strong>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loan terms</p>
          <NumInput label="Annual rate (%)" val={annualRate} onChange={setAnnualRate} prefix="%" step={0.1} />

          {/* Year selector pills */}
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {MORTGAGE_YEARS.map(y => (
                <button key={y} onClick={() => setYears(y)} style={{
                  flex: 1, padding: '5px 0', fontSize: '0.75rem', fontWeight: 700, borderRadius: 999,
                  border: '1.5px solid', cursor: 'pointer', transition: 'all 0.12s',
                  borderColor: years === y ? 'var(--foreground)' : 'var(--border)',
                  background:  years === y ? 'var(--foreground)' : 'transparent',
                  color:       years === y ? 'var(--background)' : 'var(--muted-foreground)',
                }}>{y}y</button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extra costs</p>
          <NumInput label="Agency fee"        val={agencyFee}   onChange={setAgencyFee}   step={500} />
          <NumInput label="Notary"             val={notaryFee}   onChange={setNotaryFee}   step={500} />
          <NumInput label="Bank fees"          val={bankFee}     onChange={setBankFee}     step={50} />
          <NumInput label="Taxes (IMU / IVA)"  val={taxes}       onChange={setTaxes}       step={100} />
          <NumInput label="Other (repairs…)"   val={otherCosts}  onChange={setOtherCosts}  step={1000} />

          <div style={{ padding: '0.6rem 0.75rem', background: 'var(--accent)', borderRadius: 9, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--muted-foreground)' }}>Total extra costs</span>
            <strong style={{ color: 'var(--foreground)' }}>{hidden ? '€••••••' : fmtEurCompact(extraCosts)}</strong>
          </div>
        </div>

        {/* Right: chart + amortization summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Balance chart */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Loan balance over time</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {[{ color: '#92bfdb', label: 'Balance' }, { color: '#f9ae77', label: 'Monthly interest' }].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: 180 }}>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#92bfdb" stopOpacity=".2" /><stop offset="100%" stopColor="#92bfdb" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={balArea} fill="url(#balGrad)" />
                <path d={balPath} fill="none" stroke="#92bfdb" strokeWidth="2.5" strokeLinecap="round" />
                <path d={intPath} fill="none" stroke="#f9ae77" strokeWidth="2" strokeLinecap="round" strokeDasharray="6,4" />
                {amData.map((p, i) => (
                  <text key={i} x={sx(p.m - 1)} y={H - 5} textAnchor="middle" fontSize="8.5" fill="var(--muted-foreground)" fontFamily="var(--font-sans)">
                    {addMonths(new Date(), p.m).getFullYear()}
                  </text>
                )).filter((_, i) => i % 2 === 0)}
              </svg>
            </div>
          </div>

          {/* Cost breakdown */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 1rem' }}>Total cost breakdown</h3>
            {[
              { label: 'Loan principal',  value: result.principal,      color: '#92bfdb', pct: result.totalCosts > 0 ? result.principal / result.totalCosts * 100 : 0 },
              { label: 'Down payment',    value: downPayment,           color: '#87d3c3', pct: result.totalCosts > 0 ? downPayment / result.totalCosts * 100 : 0 },
              { label: 'Total interest',  value: result.totalInterest,  color: '#f9ae77', pct: result.totalCosts > 0 ? result.totalInterest / result.totalCosts * 100 : 0 },
              { label: 'Extra costs',     value: extraCosts,            color: '#f4a4c2', pct: result.totalCosts > 0 ? extraCosts / result.totalCosts * 100 : 0 },
            ].map(({ label, value, color, pct }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.77rem', color: 'var(--foreground)', flex: 1, fontWeight: 500 }}>{label}</span>
                <div style={{ width: 80, height: 5, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--foreground)', width: 70, textAlign: 'right', flexShrink: 0 }}>{fmtH(value)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '0.75rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--foreground)' }}>Grand total</span>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.025em' }}>{fmtH(result.totalCosts)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
              <span style={{ fontSize: '0.72rem', color: '#30a46c' }}>Est. 730 tax recovery</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#30a46c' }}>-{fmtH(result.recovery730)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Net total (after 730)</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>{fmtH(result.totalCosts - result.recovery730)}</span>
            </div>
          </div>

          {/* First 12 months amortization mini-table */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Amortization schedule — year 1</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: 'var(--accent)' }}>
                    {['Month', 'Payment', 'Interest', 'Capital', 'Balance'].map((h, i) => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: i === 0 ? 'left' : 'right', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.amortization.slice(0, 12).map((row, i) => (
                    <tr key={row.m} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--accent)' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 600, color: 'var(--muted-foreground)' }}>{addMonths(new Date(), row.m).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--foreground)' }}>{hidden ? '€••' : `€${row.payment.toFixed(2)}`}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#f97316', fontWeight: 600 }}>{hidden ? '€••' : `€${row.interest.toFixed(2)}`}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#30a46c', fontWeight: 600 }}>{hidden ? '€••' : `€${row.capital.toFixed(2)}`}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--foreground)', fontWeight: 500 }}>{hidden ? '€••••••' : fmtEurFull(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Settings Modal ───────────────────────────────────────────────────────────
const SettingsModal: React.FC<{
  initial: FireSettings; onSave: (s: FireSettings) => Promise<void>;
  onClose: () => void; saving: boolean;
  isBalanceHidden: boolean; onToggleBalanceHidden: () => void;
}> = ({ initial, onSave, onClose, saving, isBalanceHidden, onToggleBalanceHidden }) => {
  const [form, setForm] = useState<FireSettings>({ ...initial });
  const set = (k: keyof FireSettings, v: any) => setForm(f => ({ ...f, [k]: v }));

  const Field = ({ label, fk, hint, pct, noPrefix }: { label: string; fk: keyof FireSettings; hint?: string; pct?: boolean; noPrefix?: boolean }) => {
    const raw     = form[fk] as number | null;
    const display = pct && raw != null ? (raw * 100).toFixed(1) : (raw ?? '');
    return (
      <div>
        <label style={{ display: 'block', fontSize: '0.67rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
        {hint && <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', margin: '-0.05rem 0 0.3rem' }}>{hint}</p>}
        <div style={{ position: 'relative' }}>
          {!noPrefix && <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '0.8rem', fontWeight: 600 }}>{pct ? '%' : '€'}</span>}
          <input type="number" step={pct ? 0.5 : 50} value={display as any}
            onChange={e => { if (!e.target.value) { set(fk, null); return; } const v = parseFloat(e.target.value); set(fk, pct ? v / 100 : v); }}
            style={{ width: '100%', padding: noPrefix ? '0.55rem 0.7rem' : '0.55rem 0.7rem 0.55rem 1.65rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '9px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,.22)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Settings size={14} color="var(--muted-foreground)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>FIRE Settings</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 3, borderRadius: 6 }}><X size={15} /></button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div onClick={onToggleBalanceHidden} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 0.9rem', background: 'var(--accent)', borderRadius: 10, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{isBalanceHidden ? '👁️' : '🙈'}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>Hide balances</p>
              <p style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{isBalanceHidden ? 'Active' : 'Tap to activate'}</p>
            </div>
            <div style={{ width: 34, height: 19, borderRadius: 999, background: isBalanceHidden ? '#30a46c' : 'var(--border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2.5, left: isBalanceHidden ? 'calc(100% - 16.5px)' : '2.5px', width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <Field label="Monthly target spending"   fk="monthly_expenses"        hint="Leave empty → 12-month budget average" />
            <Field label="Monthly net income"        fk="monthly_income_override" hint="Leave empty → budget average" />
            <Field label="INPS monthly benefit"      fk="inps_monthly" />
            <Field label="FIRE Number (optional)"    fk="fire_number"             hint="Empty → expenses × 12 × 25" />
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
        <div style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'var(--muted)', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
          <button onClick={() => onSave(form).then(onClose)} disabled={saving} style={{ padding: '0.5rem 1.25rem', background: 'var(--foreground)', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--background)', fontFamily: 'var(--font-sans)', opacity: saving ? .6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'simulation' | 'scenarios' | 'mortgage';

export const FirePage: React.FC = () => {
  const { data, loading, error, saving, refresh, saveSettings } = useFire();
  const { isBalanceHidden, toggleBalanceVisibility } = useBalancePrivacy();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab]       = useState<Tab>('overview');
  const tabLayoutId = useId();

  // ── swipe between tabs on mobile ─────────────────────────────────────────
  const TAB_ORDER: Tab[] = ['overview', 'simulation', 'scenarios', 'mortgage'];
  const swipeX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { swipeX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (swipeX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) < 50) return; // ignore taps
    const idx = TAB_ORDER.indexOf(activeTab);
    if (dx < 0 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]); // swipe left → next
    if (dx > 0 && idx > 0)                    setActiveTab(TAB_ORDER[idx - 1]); // swipe right → prev
  };
  const isMobile = useIsMobile();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 26, height: 26, border: '2.5px solid var(--foreground)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
  if (error || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: 'var(--destructive)', fontWeight: 600 }}>Failed to load FIRE data</p>
      <button onClick={refresh} style={{ padding: '8px 20px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const s              = data.settings;
  const fireNum        = s.fire_number ?? data.avg_monthly_expenses * 12 * 25;
  const firePct        = Math.min((data.net_worth / fireNum) * 100, 100);
  const passiveMonthly = data.net_worth * s.annual_return_rate / 12;
  const coverageRatio  = data.avg_monthly_expenses > 0 ? (passiveMonthly / data.avg_monthly_expenses) * 100 : 0;
  const timeToFire     = data.fire_scenarios[1];

  const TABS: [Tab, string][] = [
    ['overview',   'Overview'],
    ['simulation', isMobile ? 'Sim.' : 'Simulator'],
    ['scenarios',  isMobile ? 'FIRE' : 'Scenarios'],
    ['mortgage',   isMobile ? 'Mort.' : 'Mortgage'],
  ];

  const statBar = [
    { label: 'Net Worth',       value: fmtOrHide(data.net_worth,           isBalanceHidden, true), color: 'var(--foreground)',                                                    icon: <Wallet size={12} />,    iconBg: 'var(--muted)' },
    { label: 'Monthly Savings', value: fmtOrHide(data.avg_monthly_savings, isBalanceHidden, true), color: data.avg_monthly_savings >= 0 ? '#30a46c' : '#e5484d',                 icon: <TrendingUp size={12} />, iconBg: data.avg_monthly_savings >= 0 ? 'color-mix(in srgb, #30a46c 12%, var(--background))' : 'color-mix(in srgb, #e5484d 12%, var(--background))' },
    { label: 'Savings Rate',    value: isBalanceHidden ? '••.•%' : `${data.savings_rate.toFixed(1)}%`,                                                                           color: data.savings_rate >= 20 ? '#30a46c' : 'var(--color-orange-400)',         icon: <Activity size={12} />,  iconBg: data.savings_rate >= 20 ? 'color-mix(in srgb, #30a46c 12%, var(--background))' : 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))' },
    { label: 'FIRE Progress',   value: isBalanceHidden ? '••%' : `${firePct.toFixed(1)}%`,                                                                                       color: firePct >= 100 ? '#30a46c' : firePct >= 50 ? 'var(--color-orange-400)' : 'var(--foreground)', icon: <Target size={12} />, iconBg: 'color-mix(in srgb, #f97316 12%, var(--background))' },
    { label: 'Time to FIRE',    value: timeToFire?.years_to_fire != null ? `${timeToFire.years_to_fire.toFixed(1)} yrs` : '—',                                                   color: 'var(--foreground)',                                                    icon: <Flame size={12} />,    iconBg: 'color-mix(in srgb, #f97316 12%, var(--background))' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'color-mix(in srgb, var(--background) 92%, transparent)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', padding: isMobile ? '0.75rem' : '0.75rem 1rem',
        }}>
          {/* Left: tabs only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

            {/* Animated pill tabs — identical to Budget */}
            <nav style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'color-mix(in srgb, var(--muted) 60%, transparent)',
              borderRadius: 999, padding: 3, gap: 2,
            }}>
              {TABS.map(([key, label]) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    style={{
                      position: 'relative',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: isMobile ? '4px 8px' : '5px 14px',
                      borderRadius: 999,
                      border: 'none', background: 'transparent',
                      fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                      WebkitTapHighlightColor: 'transparent',
                      userSelect: 'none',
                      transition: 'color 0.2s',
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId={`fire-tab-${tabLayoutId}`}
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 999,
                          background: 'var(--background)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 10 }}>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={toggleBalanceVisibility}
              style={{
                width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)',
                color: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)',
                border: 'none', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
              }}
            >
              {isBalanceHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: isMobile ? '7px 10px' : '7px 14px',
                background: 'var(--muted)', color: 'var(--muted-foreground)',
                border: 'none', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Settings size={14} />
              {!isMobile && 'Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ── HERO — always visible, stable height across all tabs ──────────────── */}
      <div style={{
        background: `linear-gradient(180deg, color-mix(in srgb, #30a46c 6%, var(--background)) 0%, var(--background) 80%)`,
        borderBottom: '1px solid var(--border)',
      }}>
        <HeroChart history={data.net_worth_history} hidden={isBalanceHidden} />

        {/* FIRE progress — always shown, stable position */}
        <div style={{ padding: isMobile ? '0 1rem 0.75rem' : '0 1.5rem 0.75rem' }}>
          <FireProgress netWorth={data.net_worth} fireNumber={fireNum} hidden={isBalanceHidden} />
        </div>

        {/* Stat pills — same style as Budget desktop */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto',
          padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.5rem',
          borderTop: '1px solid var(--border)',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          {statBar.map(({ label, value, color, icon, iconBg }) => (
            <div
              key={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px 7px 8px',
                borderRadius: 999,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                flexShrink: 0,
                cursor: 'default',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--card)'; }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: iconBg, color, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{icon}</div>
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{label}</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ padding: isMobile ? `1.5rem 1rem calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` : '1.75rem 1.5rem 3rem' }}
      >

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: '1.75rem', alignItems: 'start' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Capital depletion */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Capital Depletion</h2>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>How long your wealth lasts</span>
                </div>
                <DepletionChart netWorth={data.net_worth} monthlyExpenses={data.avg_monthly_expenses} annualReturn={s.annual_return_rate} hidden={isBalanceHidden} />
              </div>

              {/* Mini stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                {[
                  { label: 'Avg income / mo',   value: fmtOrHide(data.avg_monthly_income,   isBalanceHidden, true), color: '#30a46c',                    icon: <TrendingUp size={13} /> },
                  { label: 'Avg expenses / mo',  value: fmtOrHide(data.avg_monthly_expenses, isBalanceHidden, true), color: '#e5484d',                    icon: <Activity size={13} /> },
                  { label: 'Passive / mo',       value: fmtOrHide(passiveMonthly,            isBalanceHidden, true), color: 'var(--color-orange-400)',    icon: <Zap size={13} /> },
                  { label: 'Coverage',           value: isBalanceHidden ? '••%' : `${coverageRatio.toFixed(0)}%`, color: coverageRatio >= 100 ? '#30a46c' : 'var(--color-orange-400)', icon: <Target size={13} /> },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} style={{ background: 'var(--card)', padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '0.6rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{label}</p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color, letterSpacing: '-0.02em' }}>{value}</p>
                    </div>
                    <div style={{ color, opacity: .7 }}>{icon}</div>
                  </div>
                ))}
              </div>

              {/* CTA simulator */}
              <div onClick={() => setActiveTab('simulation')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'color-mix(in srgb, #f97316 12%, var(--background))', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={15} /></div>
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>What-if Simulator</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Project wealth growth with adjustable savings, return rate & horizon</p>
                  </div>
                </div>
                <ArrowRight size={15} color="var(--muted-foreground)" />
              </div>

              {/* Mortgage CTA */}
              <div onClick={() => setActiveTab('mortgage')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'color-mix(in srgb, #2563eb 12%, var(--background))', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Home size={15} /></div>
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Mortgage Calculator</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Calculate monthly payments, total cost and 730 tax recovery</p>
                  </div>
                </div>
                <ArrowRight size={15} color="var(--muted-foreground)" />
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Runway */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Runway</h2>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Without working</span>
                </div>
                <p style={{ fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 4px', color: 'var(--foreground)' }}>
                  {fmtYears(data.runway_scenarios[0]?.months ?? 0)}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '0 0 1.1rem' }}>
                  capital only · {fmtOrHide(data.avg_monthly_expenses, isBalanceHidden, true)}/mo avg
                </p>
                {(() => {
                  const maxM   = Math.max(...data.runway_scenarios.filter(s => s.months < 9990).map(s => s.months), 60);
                  const colors = ['var(--color-blue-600)', 'var(--color-orange-400)', '#30a46c'];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {data.runway_scenarios.map((s, i) => <RunwayRow key={s.label} label={s.label} months={s.months} color={colors[i]} maxMonths={maxM} />)}
                    </div>
                  );
                })()}
              </div>

              {/* FIRE Scenarios */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>FIRE Scenarios</h2>
                  <span onClick={() => setActiveTab('scenarios')} style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', cursor: 'pointer' }}>View all →</span>
                </div>
                {data.fire_scenarios.map((sc, i) => {
                  const colors = ['var(--color-blue-600)', 'var(--color-orange-400)', '#30a46c'];
                  const icons  = [<Zap size={12} />, <Flame size={12} />, <Shield size={12} />];
                  const c = colors[i];
                  return (
                    <div key={sc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: `color-mix(in srgb, ${c} 12%, var(--background))`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons[i]}</div>
                        <div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>{sc.label}</p>
                          <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{fmtOrHide(sc.monthly_target, isBalanceHidden, true)}/mo · {fmtOrHide(sc.fire_number, isBalanceHidden, true)}</p>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, color: sc.months_to_fire === 0 ? '#30a46c' : 'var(--foreground)' }}>
                        {sc.months_to_fire === 0 ? '🎉 Done!' : sc.years_to_fire != null ? `${sc.years_to_fire.toFixed(1)} yrs` : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SIMULATOR ── */}
        {activeTab === 'simulation' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 3px', letterSpacing: '-0.02em' }}>What-if Simulator</h2>
              <p style={{ fontSize: '0.77rem', color: 'var(--muted-foreground)', margin: 0 }}>Adjust the sliders to project your wealth growth over time</p>
            </div>
            <Simulator netWorth={data.net_worth} defaultContrib={data.avg_monthly_savings} defaultRate={s.annual_return_rate} hidden={isBalanceHidden} isMobile={isMobile} />
          </div>
        )}

        {/* ── SCENARIOS ── */}
        {activeTab === 'scenarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              {data.fire_scenarios.map((sc, i) => {
                const colors = ['var(--color-blue-600)', 'var(--color-orange-400)', '#30a46c'];
                const icons  = [<Zap size={14} />, <Flame size={14} />, <Shield size={14} />];
                const c = colors[i]; const isTarget = i === 1;
                return (
                  <div key={sc.label} style={{ background: 'var(--card)', padding: '1.5rem 1.75rem', borderLeft: isTarget ? `3px solid ${c}` : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: `color-mix(in srgb, ${c} 12%, var(--background))`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons[i]}</div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{sc.label}</span>
                      {isTarget && <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `color-mix(in srgb, ${c} 12%, var(--background))`, color: c }}>Target</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {[
                        { label: 'Monthly spending', value: fmtOrHide(sc.monthly_target, isBalanceHidden) },
                        { label: 'FIRE number',       value: fmtOrHide(sc.fire_number,    isBalanceHidden), color: c },
                        { label: 'Time to FIRE',      value: sc.months_to_fire === 0 ? '🎉 Achieved!' : sc.years_to_fire != null ? `${sc.years_to_fire.toFixed(1)} years` : '—', large: true },
                      ].map(({ label, value, color, large }: any) => (
                        <div key={label}>
                          <p style={{ fontSize: '0.6rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                          <p style={{ fontSize: large ? '1.6rem' : '0.95rem', fontWeight: large ? 900 : 700, margin: 0, color: color ?? 'var(--foreground)', letterSpacing: large ? '-0.04em' : '-0.02em', lineHeight: 1 }}>{value}</p>
                          {sc.months_to_fire !== null && sc.months_to_fire > 0 && large && (
                            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '3px 0 0' }}>{Math.round(sc.months_to_fire)} months</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <h2 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Data sources</h2>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                {[
                  { label: '12-mo avg income',  value: fmtOrHide(data.avg_monthly_income,   isBalanceHidden, true) },
                  { label: '12-mo avg expenses', value: fmtOrHide(data.avg_monthly_expenses, isBalanceHidden, true) },
                  { label: 'Avg net savings',    value: fmtOrHide(data.avg_monthly_savings,  isBalanceHidden, true) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--card)', padding: '1.1rem 1.25rem' }}>
                    <p style={{ fontSize: '0.63rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>{value}</p>
                    <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', margin: '3px 0 0' }}>per month</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MORTGAGE ── */}
        {activeTab === 'mortgage' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 3px', letterSpacing: '-0.02em' }}>Mortgage Calculator</h2>
              <p style={{ fontSize: '0.77rem', color: 'var(--muted-foreground)', margin: 0 }}>Enter your property details to calculate monthly payments, total cost and 730 deduction estimate</p>
            </div>
            <MortgageCalculator hidden={isBalanceHidden} isMobile={isMobile} />
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal initial={data.settings} onSave={saveSettings} onClose={() => setShowSettings(false)}
          saving={saving} isBalanceHidden={isBalanceHidden} onToggleBalanceHidden={toggleBalanceVisibility} />
      )}

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: scale(0.92) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};
