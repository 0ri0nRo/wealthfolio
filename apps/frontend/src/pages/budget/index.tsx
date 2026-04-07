// src/pages/Budget/BudgetPageMobile.tsx

import { useBalancePrivacy } from '@/hooks/use-balance-privacy';
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/lib/types/budget';
import {
  RecurringEntryAsTx,
  RecurringExpense,
  isRecurringActiveInMonth,
} from '@/lib/types/recurring';
import {
  ArrowDown, ArrowUp, BarChart2, ChevronLeft, ChevronRight, ChevronRight as ChevronRightSmall,
  Copy, Edit2, Plus, RefreshCw, Search, Settings, SlidersHorizontal, Tag,
  Trash2, TrendingDown, TrendingUp, UtensilsCrossed, Wallet, X,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddTransactionModal } from './components/add-transaction-modal';
import { BudgetChart } from './components/budget-chart';
import { BudgetInsights } from './components/budget-insights';
import { ExportModal } from './components/ExportModal';
import { ManageCategoriesModal } from './components/ManageCategoriesModal';
import { RecurringExpenseModal } from './components/recurring-expense-modal';
import { RecurringExpensesTable } from './components/recurring-expenses-table';
import { YearlyStats } from './components/YearlyStats';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const isMealVoucher = (t: BudgetTransaction | RecurringEntryAsTx) => {
  if ('category' in t)
    return (t as BudgetTransaction).category?.name?.toLowerCase().includes('buoni pasto') ?? false;
  return false;
};

const isInvestmentTx = (t: BudgetTransaction) => {
  if (!t.category) return false;
  const n = t.category.name.toLowerCase();
  return n.includes('invest') || n.includes('crypto') || n.includes('etf') || n.includes('stock');
};

const fmtEur = (n: number) => `€${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `€${(abs / 1000).toFixed(1)}k` : `€${abs.toFixed(0)}`;
  return n < 0 ? `-${s}` : s;
};

type ActiveTab = 'overview' | 'transactions' | 'yearly' | 'recurring';
type SortKey = 'date' | 'amount';
type SortDir = 'desc' | 'asc';

const RECURRING_KEY = 'budget_recurring_ids';
function loadRecurring(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(RECURRING_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function saveRecurring(s: Set<string>) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify([...s]));
}

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastState { message: string; visible: boolean; }
const ToastContext = React.createContext<(msg: string) => void>(() => {});
const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    clearTimeout(timerRef.current);
    setToast({ message: msg, visible: true });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  }, []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 'calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 12px)',
        left: '50%',
        transform: `translateX(-50%) translateY(${toast.visible ? '0' : '16px'})`,
        opacity: toast.visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s',
        pointerEvents: 'none',
        zIndex: 999,
        background: 'var(--foreground)',
        color: 'var(--background)',
        borderRadius: '999px',
        padding: '9px 20px',
        fontSize: '0.8rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
        {toast.message}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => React.useContext(ToastContext);

// ─── Action Sheet ─────────────────────────────────────────────────────────────
interface ActionSheetProps {
  transaction: any | null;
  isRecurring: boolean;
  isRecurringEntry: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleRecurring: () => void;
}
const ActionSheet: React.FC<ActionSheetProps> = ({
  transaction: t, isRecurring, isRecurringEntry, onClose,
  onEdit, onDelete, onDuplicate, onToggleRecurring,
}) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (t) { requestAnimationFrame(() => setVisible(true)); document.body.style.overflow = 'hidden'; }
    else { setVisible(false); document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [t]);
  if (!t) return null;
  const isIncome = t.type === 'income';
  const amtColor = isIncome ? 'var(--success)' : 'var(--destructive)';
  const actionRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    padding: '0.8rem 1.25rem', cursor: 'pointer', border: 'none',
    background: 'transparent', width: '100%', fontFamily: 'var(--font-sans)',
    transition: 'background 0.12s', WebkitTapHighlightColor: 'transparent',
  };
  const iconBoxStyle = (bg: string, color: string): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: visible ? 'rgba(0,0,0,0.35)' : 'transparent', transition: 'background 0.2s' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90, background: 'var(--card)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--muted)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: isRecurringEntry ? 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))' : isIncome ? 'color-mix(in srgb, var(--success) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isRecurringEntry ? <RefreshCw size={15} color="var(--color-orange-400)" /> : isIncome ? <TrendingUp size={15} color="var(--success)" /> : <TrendingDown size={15} color="var(--destructive)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || t.category?.name || '—'}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{t.category?.name ?? '—'} · {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
          </div>
          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: isRecurringEntry ? 'var(--color-orange-400)' : amtColor, letterSpacing: '-0.01em' }}>
            {isIncome ? '+' : '-'}{fmtEur(t.amount)}
          </span>
        </div>
        {!isRecurringEntry && (
          <>
            <button style={actionRowStyle} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} onClick={onEdit}>
              <div style={iconBoxStyle('color-mix(in srgb, var(--color-blue-600) 12%, var(--background))', 'var(--color-blue-600)')}><Edit2 size={15} /></div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>Edit transaction</span>
            </button>
            <button style={actionRowStyle} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} onClick={onDuplicate}>
              <div style={iconBoxStyle('var(--muted)', 'var(--muted-foreground)')}><Copy size={15} /></div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>Duplicate</span>
            </button>
            <button style={actionRowStyle} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} onClick={onToggleRecurring}>
              <div style={iconBoxStyle(isRecurring ? 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))' : 'var(--muted)', isRecurring ? 'var(--color-orange-400)' : 'var(--muted-foreground)')}><RefreshCw size={15} /></div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{isRecurring ? 'Unmark as fixed' : 'Mark as fixed'}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{isRecurring ? 'Remove from fixed costs' : 'Include in fixed costs breakdown'}</p>
              </div>
            </button>
          </>
        )}
        <button style={{ ...actionRowStyle, borderTop: !isRecurringEntry ? '1px solid var(--border)' : undefined, marginTop: !isRecurringEntry ? '4px' : 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--destructive) 6%, var(--card))')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={onDelete}>
          <div style={iconBoxStyle('color-mix(in srgb, var(--destructive) 12%, var(--background))', 'var(--destructive)')}><Trash2 size={15} /></div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--destructive)' }}>{isRecurringEntry ? 'Remove this entry' : 'Delete transaction'}</span>
        </button>
        <div style={{ padding: '8px 1rem 0' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', WebkitTapHighlightColor: 'transparent' }}>Cancel</button>
        </div>
      </div>
    </>
  );
};

// ─── LongPressRow ─────────────────────────────────────────────────────────────
const LongPressRow: React.FC<{
  transaction: any; isRecurring: boolean; isRecurringEntry: boolean;
  isBalanceHidden: boolean; isMobile: boolean;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
  onToggleRecurring: () => void; onLongPress: () => void;
}> = ({ transaction: t, isRecurring, isRecurringEntry, isBalanceHidden, isMobile, onEdit, onDelete, onDuplicate, onToggleRecurring, onLongPress }) => {
  const lpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pressing, setPressing] = useState(false);
  const startPress = () => { setPressing(true); lpTimer.current = setTimeout(() => { setPressing(false); onLongPress(); }, 500); };
  const cancelPress = () => { clearTimeout(lpTimer.current); setPressing(false); };
  const isIncome = t.type === 'income';
  const amtColor = isIncome ? 'var(--success)' : 'var(--destructive)';
  const catName = t.category?.name ?? '—';
  const dateStr = new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return (
    <div
      style={{ position: 'relative', borderBottom: '1px solid var(--border)', background: pressing ? 'var(--accent)' : isRecurringEntry ? 'color-mix(in srgb, var(--color-orange-400) 3%, var(--card))' : 'var(--card)', transition: 'background 0.15s', userSelect: 'none', WebkitUserSelect: 'none' }}
      onTouchStart={isMobile ? startPress : undefined}
      onTouchEnd={isMobile ? cancelPress : undefined}
      onTouchMove={isMobile ? cancelPress : undefined}
      onMouseDown={!isMobile ? startPress : undefined}
      onMouseUp={!isMobile ? cancelPress : undefined}
      onMouseLeave={!isMobile ? cancelPress : undefined}
      onClick={() => { if (!isMobile && !isRecurringEntry) onEdit(); }}
      onMouseEnter={e => { if (!isMobile) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', cursor: isRecurringEntry ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: isRecurringEntry ? 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))' : isIncome ? 'color-mix(in srgb, var(--success) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRecurringEntry ? <RefreshCw size={14} color="var(--color-orange-400)" /> : isIncome ? <TrendingUp size={14} color="var(--success)" /> : <TrendingDown size={14} color="var(--destructive)" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || catName}</span>
            {isRecurringEntry && <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', fontSize: '0.6rem', fontWeight: 700 }}><RefreshCw size={8} />Recurring</span>}
            {!isRecurringEntry && isRecurring && <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', fontSize: '0.6rem', fontWeight: 700 }}><RefreshCw size={8} />Fixed</span>}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>{catName} · {dateStr}</span>
          {t.notes && !t.notes.startsWith('recurring:') && <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>{t.notes}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isRecurringEntry ? 'var(--color-orange-400)' : amtColor, letterSpacing: '-0.01em' }}>
            {isBalanceHidden ? '€••••••' : `${isIncome ? '+' : '-'}${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, style: 'currency', currency: 'EUR' }).replace('€', '€')}`}
          </span>
          {!isMobile && !isRecurringEntry && (
            <div style={{ display: 'flex', gap: 3 }}>
              {([
                { icon: <RefreshCw size={11} />, fn: onToggleRecurring, title: isRecurring ? 'Unmark fixed' : 'Mark fixed', active: isRecurring, danger: false },
                { icon: <Copy size={11} />, fn: onDuplicate, title: 'Duplicate', active: false, danger: false },
                { icon: <Edit2 size={11} />, fn: onEdit, title: 'Edit', active: false, danger: false },
                { icon: <Trash2 size={11} />, fn: onDelete, title: 'Delete', active: false, danger: true },
              ]).map(({ icon, fn, title, active, danger }) => (
                <button key={title} onClick={e => { e.stopPropagation(); fn(); }} title={title}
                  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s', background: active ? 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))' : 'var(--muted)', color: active ? 'var(--color-orange-400)' : 'var(--muted-foreground)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? 'color-mix(in srgb, var(--destructive) 12%, var(--background))' : 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = danger ? 'var(--destructive)' : 'var(--foreground)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))' : 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.color = active ? 'var(--color-orange-400)' : 'var(--muted-foreground)'; }}
                >{icon}</button>
              ))}
            </div>
          )}
          {!isMobile && isRecurringEntry && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Remove entry"
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, cursor: 'pointer', background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--destructive) 12%, var(--background))'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--destructive)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)'; }}
            ><Trash2 size={11} /></button>
          )}
          {isMobile && (
            <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.5 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="2" r="1" fill="currentColor" />
                <circle cx="5" cy="5" r="1" fill="currentColor" />
                <circle cx="5" cy="8" r="1" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Revolut Donut chart ──────────────────────────────────────────────────────
const RevolutDonut: React.FC<{
  spent: number;
  income: number;
  isBalanceHidden: boolean;
  month: string;
  categories: { name: string; amount: number; color: string }[];
}> = ({ spent, income, isBalanceHidden, month, categories }) => {
  const size = 220;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = income > 0 ? Math.min(spent / income, 1) : 0;
  const remaining = income - spent;
  const isOver = remaining < 0;

  const totalCatAmt = categories.reduce((s, c) => s + c.amount, 0);
  let cumulAngle = -90;
  const catArcs = categories.map(cat => {
    const catPct = totalCatAmt > 0 ? cat.amount / totalCatAmt : 0;
    const sweep = catPct * 360 * pct;
    const start = cumulAngle;
    cumulAngle += sweep;
    return { ...cat, startAngle: start, sweepAngle: sweep };
  });

  const polarToCartesian = (angle: number, rad: number) => {
    const a = (angle * Math.PI) / 180;
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  };

  const describeArc = (startAngle: number, endAngle: number, rad: number) => {
    const start = polarToCartesian(startAngle, rad);
    const end = polarToCartesian(endAngle, rad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${rad} ${rad} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} opacity={0.4} />
        {catArcs.map((arc, i) =>
          arc.sweepAngle > 0.5 ? (
            <path key={i} d={describeArc(arc.startAngle, arc.startAngle + arc.sweepAngle, r)} fill="none" stroke={arc.color} strokeWidth={strokeWidth} strokeLinecap="round" />
          ) : null
        )}
        {categories.length === 0 && pct > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={isOver ? 'var(--destructive)' : 'var(--success)'} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)} strokeLinecap="round" style={{ transformOrigin: `${cx}px ${cy}px`, transform: 'rotate(-90deg)' }} />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Spent</span>
        <span style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.03em', color: isOver ? 'var(--destructive)' : 'var(--foreground)', lineHeight: 1 }}>
          {isBalanceHidden ? '€•••' : fmtEur(spent)}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', marginTop: 4, fontWeight: 500 }}>{month}</span>
        {!isBalanceHidden && (
          <span style={{ marginTop: 6, fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: isOver ? 'color-mix(in srgb, var(--destructive) 12%, var(--background))' : 'color-mix(in srgb, var(--success) 12%, var(--background))', color: isOver ? 'var(--destructive)' : 'var(--success)' }}>
            {isOver ? `-${fmtEur(Math.abs(remaining))} over` : `${fmtEur(remaining)} left`}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── NavTile ──────────────────────────────────────────────────────────────────
const NavTile: React.FC<{
  icon: React.ReactNode; label: string;
  iconColor: string; iconBg: string;
  value?: string; valueColor?: string;
  onClick: () => void;
}> = ({ icon, label, iconColor, iconBg, value, valueColor, onClick }) => (
  <button
    onClick={onClick}
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '0.85rem 0.9rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'background 0.15s', flex: 1 }}
    onTouchStart={e => (e.currentTarget.style.background = 'var(--accent)')}
    onTouchEnd={e => (e.currentTarget.style.background = 'var(--card)')}
  >
    <div style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
    <div>
      <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--muted-foreground)', margin: 0 }}>{label}</p>
      {value && <p style={{ fontSize: '0.82rem', fontWeight: 700, color: valueColor ?? 'var(--foreground)', margin: '1px 0 0', letterSpacing: '-0.01em' }}>{value}</p>}
    </div>
  </button>
);

// ─── Category colors ──────────────────────────────────────────────────────────
const CAT_COLORS = [
  '#34d399', '#60a5fa', '#f97316', '#a78bfa', '#fb7185',
  '#fbbf24', '#38bdf8', '#4ade80', '#e879f9', '#f43f5e',
];

// ─── Delta Badge ──────────────────────────────────────────────────────────────
const DeltaBadge: React.FC<{ delta: number; label: string; small?: boolean }> = ({ delta, label, small }) => {
  if (delta === 0) return null;
  const isExpense = label === 'Expenses';
  const isPositive = delta > 0;
  const isGood = isExpense ? !isPositive : isPositive;
  const color = isGood ? 'var(--success)' : 'var(--destructive)';
  const bg = isGood ? 'color-mix(in srgb, var(--success) 10%, var(--background))' : 'color-mix(in srgb, var(--destructive) 10%, var(--background))';
  return (
    <span style={{ flexShrink: 0, fontSize: small ? '0.55rem' : '0.6rem', fontWeight: 700, padding: small ? '1px 4px' : '1px 5px', borderRadius: 999, background: bg, color, whiteSpace: 'nowrap' }}>
      {isPositive ? '+' : ''}{fmtCompact(delta)}
    </span>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ onAdd: () => void; message: string; compact?: boolean }> = ({ onAdd, message, compact }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: compact ? '1.5rem 1rem' : '3rem 1.5rem', gap: '0.75rem', textAlign: 'center' }}>
    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <TrendingUp size={20} color="var(--muted-foreground)" />
    </div>
    <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', margin: 0, fontWeight: 500 }}>{message}</p>
    <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <Plus size={12} /> Add transaction
    </button>
  </div>
);

// ─── Fixed vs Discretionary Card ─────────────────────────────────────────────
const FixedVsDiscretionaryCard: React.FC<{
  recurringFixed: number; discretionary: number; totalExpenses: number;
  recurringMonthlyTotal: number; entryTxns: RecurringEntryAsTx[]; isBalanceHidden: boolean;
}> = ({ recurringFixed, discretionary, totalExpenses, entryTxns, isBalanceHidden }) => {
  const fixedPct = totalExpenses > 0 ? Math.round((recurringFixed / totalExpenses) * 100) : 0;
  const topEntries = entryTxns.slice(0, 4);
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.85rem' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={13} /></div>
        <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Fixed vs Discretionary</h3>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)' }}>{entryTxns.length} recurring</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '0.85rem' }}>
        <div style={{ background: 'color-mix(in srgb, var(--destructive) 7%, var(--background))', borderRadius: 10, padding: '0.7rem' }}>
          <p style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fixed costs</p>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--destructive)', margin: 0, letterSpacing: '-0.025em' }}>{isBalanceHidden ? '€••••••' : fmtEur(recurringFixed)}</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{fixedPct}% of expenses</p>
        </div>
        <div style={{ background: 'color-mix(in srgb, var(--color-blue-600) 7%, var(--background))', borderRadius: 10, padding: '0.7rem' }}>
          <p style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Discretionary</p>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-blue-600)', margin: 0, letterSpacing: '-0.025em' }}>{isBalanceHidden ? '€••••••' : fmtEur(discretionary)}</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{100 - fixedPct}% of expenses</p>
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden', marginBottom: '0.75rem' }}>
        <div style={{ height: '100%', width: `${fixedPct}%`, background: 'var(--destructive)', borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>
      {topEntries.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={10} color="var(--color-orange-400)" />
            <span style={{ color: 'var(--muted-foreground)' }}>{e.description}</span>
          </div>
          <span style={{ fontWeight: 700, color: 'var(--destructive)' }}>{isBalanceHidden ? '€••' : fmtEur(e.amount)}</span>
        </div>
      ))}
      {entryTxns.length > 4 && <p style={{ fontSize: '0.63rem', color: 'var(--muted-foreground)', margin: '4px 0 0' }}>+{entryTxns.length - 4} more recurring</p>}
    </div>
  );
};

// ─── Stat Cards ───────────────────────────────────────────────────────────────
interface StatCard { label: string; value: number; delta?: number; icon: React.ReactNode; iconColor: string; iconBg: string; }
const StatCards: React.FC<{ cards: StatCard[]; isBalanceHidden: boolean }> = ({ cards, isBalanceHidden }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
    {cards.map(({ label, value, delta, icon, iconColor, iconBg }) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 7px 8px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--border)', flexShrink: 0, transition: 'background 0.15s', cursor: 'default' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--card)'; }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: (label === 'Cash' || label === 'Meal Vouchers') ? iconColor : 'var(--foreground)', whiteSpace: 'nowrap', letterSpacing: isBalanceHidden ? '0.02em' : '-0.01em' }}>
          {isBalanceHidden ? '€••••••' : fmtEur(value)}
        </span>
        {delta !== undefined && !isBalanceHidden && <DeltaBadge delta={delta} label={label} />}
      </div>
    ))}
  </div>
);

// ─── Recurring Mini Table ─────────────────────────────────────────────────────
const RecurringMiniTable: React.FC<{
  recurringExpenses: RecurringExpense[]; entryTxns: RecurringEntryAsTx[];
  isBalanceHidden: boolean; onViewAll: () => void; onAdd: () => void;
}> = ({ recurringExpenses, entryTxns, isBalanceHidden, onViewAll, onAdd }) => {
  const FREQ_LABEL: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2w', monthly: 'Monthly', bimonthly: 'Every 2m', quarterly: 'Quarterly', semiannual: 'Every 6m', annual: 'Yearly', yearly: 'Yearly', custom: 'Custom' };
  const active = recurringExpenses.filter(e => e.isActive);
  const monthlyTotal = entryTxns.reduce((s, e) => s + e.amount, 0);
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: 'var(--color-orange-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={11} /></div>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Recurring</h2>
          {active.length > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{active.length}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {active.length > 0 && <span onClick={onViewAll} style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>Manage</span>}
          <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 7, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}><Plus size={10} />Add</button>
        </div>
      </div>
      {active.length === 0 ? (
        <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}><RefreshCw size={16} color="var(--muted-foreground)" /></div>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: '0 0 0.65rem', fontWeight: 500 }}>No recurring expenses yet</p>
          <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}><Plus size={11} />Add first</button>
        </div>
      ) : (
        <>
          {entryTxns.slice(0, 6).map(e => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center', padding: '0.6rem 1.1rem', borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
              onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</p>
              <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-orange-400) 10%, var(--background))', color: 'var(--color-orange-400)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                {FREQ_LABEL[recurringExpenses.find(r => String(r.id) === String(e.recurringExpenseId))?.frequency ?? ''] ?? '—'}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--destructive)', whiteSpace: 'nowrap', textAlign: 'right', letterSpacing: '-0.01em' }}>{isBalanceHidden ? '€••••' : `-${fmtEur(e.amount)}`}</span>
            </div>
          ))}
          {entryTxns.length > 6 && <div onClick={onViewAll} style={{ padding: '0.6rem 1.1rem', fontSize: '0.72rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500, textAlign: 'center' }}>+{entryTxns.length - 6} more — view all</div>}
          <div style={{ padding: '0.65rem 1.1rem', background: 'var(--accent)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>Total this month</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--destructive)', letterSpacing: '-0.02em' }}>{isBalanceHidden ? '€••••••' : `-${fmtEur(monthlyTotal)}`}</span>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const BudgetPage: React.FC = () => {

  // ─── ALL STATE (must come first, before any conditional returns) ───────────
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showGearMenu, setShowGearMenu] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [sheet, setSheet] = useState<{ tx: any; isRecurring: boolean; isEntry: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCatId, setFilterCatId] = useState<number | null>(null);
  const [filterAmtMin, setFilterAmtMin] = useState('');
  const [filterAmtMax, setFilterAmtMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [recurringIds, setRecurringIds] = useState<Set<string>>(loadRecurring);

  // ─── ALL REFS ──────────────────────────────────────────────────────────────
  const gearRef = useRef<HTMLDivElement>(null);

  // ─── HOOKS ────────────────────────────────────────────────────────────────
  const isMobile = useIsMobile();
  const showToast = useToast();
  const { isBalanceHidden, toggleBalanceVisibility } = useBalancePrivacy();

  const {
    transactions, allTransactions, categories, summary, loading, error,
    createTransaction, deleteTransaction, updateTransaction, refresh,
    createCategory, updateCategory, deleteCategory,
    recurringExpenses, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
    recurringEntryTxns, deleteRecurringEntry,
  } = useBudget(selectedMonth);

  // ─── ALL EFFECTS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showGearMenu) return;
    const h = (e: MouseEvent) => { if (gearRef.current && !gearRef.current.contains(e.target as Node)) setShowGearMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showGearMenu]);

  // ─── DERIVED DATA ─────────────────────────────────────────────────────────
  const txList = transactions || [];
  const allTxList = allTransactions || [];
  const recurringList = recurringExpenses || [];
  const entryTxns = recurringEntryTxns || [];

  const bpIncomeMonth = txList.filter(t => t.type === 'income' && isMealVoucher(t)).reduce((s, t) => s + t.amount, 0);
  const bpIncomeAll = allTxList.filter(t => t.type === 'income' && isMealVoucher(t)).reduce((s, t) => s + t.amount, 0);
  const bpExpensesAll = allTxList.filter(t => t.type === 'expense' && isMealVoucher(t)).reduce((s, t) => s + t.amount, 0);
  const bpBalance = bpIncomeAll - bpExpensesAll;

  const investments = txList.filter(t => t.type === 'expense' && isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const totalIncome = summary?.totalIncome ?? 0;

  const txExpensesTotal = txList.filter(t => t.type === 'expense' && !isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const recurringMonthlyTotal = entryTxns.reduce((s, e) => s + e.amount, 0);
  const expensesTotal = txExpensesTotal + recurringMonthlyTotal;

  const prevMonth = useMemo(() => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, [selectedMonth]);

  const prevMonthTx = useMemo(() =>
    allTxList.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
    }),
    [allTxList, prevMonth]
  );

  const prevIncome = prevMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevTxExpenses = prevMonthTx.filter(t => t.type === 'expense' && !isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const prevSavings = prevMonthTx.filter(t => t.type === 'expense' && isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);

  const prevRecurringTotal = useMemo(() =>
    recurringList
      .filter(e => isRecurringActiveInMonth(e, prevMonth.getFullYear(), prevMonth.getMonth() + 1))
      .reduce((s, e) => s + e.amount, 0),
    [recurringList, prevMonth]
  );

  const prevExpenses = prevTxExpenses + prevRecurringTotal;

  const currentMonthIncome = totalIncome - bpIncomeMonth;
  const currentMonthExpenses = txList.filter(t => t.type === 'expense' && !isMealVoucher(t) && !isInvestmentTx(t)).reduce((s, t) => s + t.amount, 0);
  const cashBalance = currentMonthIncome - currentMonthExpenses - recurringMonthlyTotal - investments;

  const combinedTxList = useMemo(() => {
    const entryAsAny = entryTxns.map(e => ({ ...e, categoryId: e.categoryId, category: categories.find(c => Number(c.id) === e.categoryId) }));
    return [...txList, ...entryAsAny as any[]].sort((a, b) => b.date.localeCompare(a.date));
  }, [txList, entryTxns, categories]);

  const entryTxnsAsTx = useMemo(() =>
    entryTxns.map(e => ({ ...e, type: 'expense' as const, category: categories.find(c => Number(c.id) === e.categoryId) })),
    [entryTxns, categories]
  );

  const filteredTx = useMemo(() => {
    let r = combinedTxList;
    if (search) r = r.filter((t: any) => [t.description, t.notes, t.category?.name].some((s: any) => s?.toLowerCase().includes(search.toLowerCase())));
    if (filterType !== 'all') r = r.filter((t: any) => t.type === filterType);
    if (filterCatId) r = r.filter((t: any) => Number(t.category?.id ?? t.categoryId) === filterCatId);
    const mn = parseFloat(filterAmtMin); if (!isNaN(mn)) r = r.filter((t: any) => t.amount >= mn);
    const mx = parseFloat(filterAmtMax); if (!isNaN(mx)) r = r.filter((t: any) => t.amount <= mx);
    return [...r].sort((a: any, b: any) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortKey === 'amount') cmp = b.amount - a.amount;
      return sortDir === 'desc' ? cmp : -cmp;
    });
  }, [combinedTxList, search, filterType, filterCatId, filterAmtMin, filterAmtMax, sortKey, sortDir]);

  const manualRecurringFixed = txList.filter(t => recurringIds.has(String(t.id)) && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalRecurringFixed = manualRecurringFixed + recurringMonthlyTotal;
  const discretionary = expensesTotal - totalRecurringFixed;

  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    txList.filter(t => t.type === 'expense' && !isInvestmentTx(t)).forEach(t => {
      const name = t.category?.name ?? 'Other';
      map.set(name, (map.get(name) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, amount], i) => ({ name, amount, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [txList]);

  const monthLabel = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - expensesTotal) / totalIncome) * 100) : 0;
  const hasActiveFilter = !!(search || filterType !== 'all' || filterCatId || filterAmtMin || filterAmtMax);
  const isCurrentMonth = selectedMonth.getMonth() === new Date().getMonth() && selectedMonth.getFullYear() === new Date().getFullYear();

  // ─── ALL CALLBACKS ────────────────────────────────────────────────────────
  const toggleRecurring = useCallback((id: string) => {
    setRecurringIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveRecurring(next);
      return next;
    });
  }, []);

  const openSheet = useCallback((t: any) => {
    setSheet({ tx: t, isRecurring: recurringIds.has(String(t.id)), isEntry: !!t.isRecurringEntry });
  }, [recurringIds]);

  const closeSheet = useCallback(() => setSheet(null), []);

  const clearFilters = useCallback(() => {
    setSearch(''); setFilterType('all'); setFilterCatId(null); setFilterAmtMin(''); setFilterAmtMax('');
  }, []);

  const goToPrevMonth = useCallback(() => {
    const d = new Date(selectedMonth); d.setMonth(d.getMonth() - 1); setSelectedMonth(d);
  }, [selectedMonth]);

  const goToNextMonth = useCallback(() => {
    const d = new Date(selectedMonth); d.setMonth(d.getMonth() + 1); setSelectedMonth(d);
  }, [selectedMonth]);

  const handleAddTransaction = useCallback(async (transaction: Partial<BudgetTransaction>) => {
    try {
      if (editingTransaction) {
        await updateTransaction(Number(editingTransaction.id), transaction);
        showToast('Transaction updated');
      } else {
        await createTransaction({ categoryId: transaction.categoryId!, amount: transaction.amount!, type: transaction.type!, description: transaction.description!, date: transaction.date!, notes: transaction.notes });
        showToast('Transaction added');
      }
      setShowAddModal(false); setEditingTransaction(null);
    } catch (err) { alert('Error saving transaction: ' + (err instanceof Error ? err.message : 'Unknown error')); }
  }, [editingTransaction, updateTransaction, createTransaction, showToast]);

  const handleDuplicate = useCallback(async (t: BudgetTransaction) => {
    try {
      await createTransaction({ categoryId: t.categoryId ?? (t.category?.id as number), amount: t.amount, type: t.type, description: `${t.description} (copy)`, date: t.date, notes: t.notes });
      showToast('Transaction duplicated');
    } catch {}
  }, [createTransaction, showToast]);

  const handleDeleteTransaction = useCallback(async (id: string | number) => {
    if (typeof id === 'string' && id.startsWith('rec-')) {
      const entryId = id.replace('rec-', '');
      try { await deleteRecurringEntry(entryId); showToast('Entry removed'); } catch {}
    } else {
      try { await deleteTransaction(id); showToast('Transaction deleted'); } catch {}
    }
  }, [deleteRecurringEntry, deleteTransaction, showToast]);

  const handleAddRecurringExpense = useCallback(async (expense: Partial<RecurringExpense>) => {
    try {
      const categoryId = typeof expense.categoryId === 'string' ? parseInt(expense.categoryId, 10) : (expense.categoryId || 0);
      const payload: Partial<RecurringExpense> = { categoryId, amount: expense.amount, description: expense.description, frequency: expense.frequency, customDays: expense.customDays, startDate: expense.startDate, endDate: expense.endDate || null, notes: expense.notes, isActive: true };
      if (editingRecurring) { await updateRecurringExpense(Number(editingRecurring.id), payload); showToast('Recurring expense updated'); }
      else { await createRecurringExpense(payload); showToast('Recurring expense added'); }
      setShowRecurringModal(false); setEditingRecurring(null);
    } catch (err) { alert('Error saving recurring expense: ' + (err instanceof Error ? err.message : 'Unknown error')); }
  }, [editingRecurring, updateRecurringExpense, createRecurringExpense, showToast]);

  const handleDeleteRecurringExpense = useCallback(async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this recurring expense?')) return;
    try { await deleteRecurringExpense(id); showToast('Recurring expense deleted'); }
    catch (err) { console.error('Error deleting recurring expense:', err); }
  }, [deleteRecurringExpense, showToast]);

  const handleDuplicateRecurringExpense = useCallback(async (expense: RecurringExpense) => {
    try {
      await createRecurringExpense({ categoryId: expense.categoryId, amount: expense.amount, description: `${expense.description} (copy)`, frequency: expense.frequency, customDays: expense.customDays, startDate: new Date().toISOString().split('T')[0], endDate: null, notes: expense.notes, isActive: true });
      showToast('Recurring expense duplicated');
    } catch (err) { console.error('Error duplicating recurring expense:', err); }
  }, [createRecurringExpense, showToast]);

  const handleSheetEdit = useCallback(() => {
    closeSheet();
    if (sheet?.tx && !sheet.tx.isRecurringEntry) { setEditingTransaction(sheet.tx); setShowAddModal(true); }
  }, [sheet, closeSheet]);

  const handleSheetDelete = useCallback(async () => {
    closeSheet();
    if (sheet?.tx) await handleDeleteTransaction(sheet.tx.id);
  }, [sheet, closeSheet, handleDeleteTransaction]);

  const handleSheetDuplicate = useCallback(() => {
    closeSheet();
    if (sheet?.tx && !sheet.tx.isRecurringEntry) handleDuplicate(sheet.tx);
  }, [sheet, closeSheet, handleDuplicate]);

  const handleSheetToggleRecurring = useCallback(() => {
    closeSheet();
    if (sheet?.tx && !sheet.tx.isRecurringEntry) {
      const wasFixed = recurringIds.has(String(sheet.tx.id));
      toggleRecurring(String(sheet.tx.id));
      showToast(wasFixed ? 'Removed from fixed costs' : 'Marked as fixed');
    }
  }, [sheet, closeSheet, recurringIds, toggleRecurring, showToast]);

  // ─── Stat cards (memoized to avoid JSX in render) ────────────────────────
  const statCards = useMemo<StatCard[]>(() => [
    { label: 'Income', value: totalIncome, delta: prevIncome > 0 ? totalIncome - prevIncome : undefined, icon: <TrendingUp size={16} />, iconColor: 'var(--success)', iconBg: 'color-mix(in srgb, var(--success) 12%, var(--background))' },
    { label: 'Expenses', value: expensesTotal, delta: prevExpenses > 0 ? expensesTotal - prevExpenses : undefined, icon: <TrendingDown size={16} />, iconColor: 'var(--destructive)', iconBg: 'color-mix(in srgb, var(--destructive) 12%, var(--background))' },
    { label: 'Savings', value: investments, delta: prevSavings > 0 ? investments - prevSavings : undefined, icon: <TrendingUp size={16} />, iconColor: 'var(--color-purple-600)', iconBg: 'color-mix(in srgb, var(--color-purple-600) 12%, var(--background))' },
    { label: 'Cash', value: cashBalance, icon: <Wallet size={16} />, iconColor: cashBalance >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)', iconBg: cashBalance >= 0 ? 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))' },
    { label: 'Meal Vouchers', value: bpBalance, icon: <UtensilsCrossed size={16} />, iconColor: bpBalance >= 0 ? 'var(--color-orange-400)' : 'var(--destructive)', iconBg: bpBalance >= 0 ? 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))' },
  ], [totalIncome, prevIncome, expensesTotal, prevExpenses, investments, prevSavings, cashBalance, bpBalance]);

  // ─── renderRow helper ─────────────────────────────────────────────────────
  const renderRow = (t: any) => (
    <LongPressRow
      key={t.id} transaction={t}
      isRecurring={recurringIds.has(String(t.id))}
      isRecurringEntry={!!t.isRecurringEntry}
      isBalanceHidden={isBalanceHidden}
      isMobile={isMobile}
      onEdit={() => { if (!t.isRecurringEntry) { setEditingTransaction(t); setShowAddModal(true); } }}
      onDelete={() => handleDeleteTransaction(t.id)}
      onDuplicate={() => { if (!t.isRecurringEntry) handleDuplicate(t); }}
      onToggleRecurring={() => { if (!t.isRecurringEntry) toggleRecurring(String(t.id)); }}
      onLongPress={() => openSheet(t)}
    />
  );

  // ─── CONDITIONAL RETURNS (only after ALL hooks) ───────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid var(--foreground)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
      <div style={{ textAlign: 'center', padding: '0 1.5rem' }}>
        <p style={{ color: 'var(--destructive)', fontWeight: 600, marginBottom: 8 }}>Error loading budget data</p>
        <p style={{ color: 'var(--muted-foreground)', marginBottom: 24 }}>{error}</p>
        <button onClick={refresh} style={{ padding: '8px 20px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════════════════════════
  if (!isMobile) {
    const TABS: [ActiveTab, string][] = [['overview', 'Overview'], ['transactions', 'Transactions'], ['yearly', 'Annual'], ['recurring', 'Recurring']];
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem' }}>
            <nav style={{ display: 'inline-flex', alignItems: 'center', background: 'color-mix(in srgb, var(--muted) 60%, transparent)', borderRadius: '999px', padding: '3px', gap: '2px' }}>
              {TABS.map(([key, label]) => {
                const isActive = activeTab === key;
                return (
                  <button key={key} type="button" onClick={() => setActiveTab(key)} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 14px', borderRadius: '999px', border: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent', userSelect: 'none', transition: 'color 0.2s' }}>
                    {isActive && <motion.div layoutId="budget-tab-indicator" style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: 'var(--background)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} initial={false} transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                    <span style={{ position: 'relative', zIndex: 10 }}>{label}</span>
                  </button>
                );
              })}
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {activeTab !== 'yearly' && activeTab !== 'recurring' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button onClick={goToPrevMonth} style={{ width: 28, height: 28, border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><ChevronLeft size={15} /></button>
                  <button onClick={() => setSelectedMonth(new Date())} style={{ padding: '4px 10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent', background: isCurrentMonth ? 'var(--muted)' : 'color-mix(in srgb, var(--color-orange-400) 15%, var(--background))', color: isCurrentMonth ? 'var(--foreground)' : 'var(--color-orange-400)' }}>
                    {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </button>
                  <button onClick={goToNextMonth} style={{ width: 28, height: 28, border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><ChevronRight size={15} /></button>
                </div>
              )}
              <div ref={gearRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowGearMenu(v => !v)} style={{ width: 34, height: 34, border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent', background: showGearMenu || isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', color: showGearMenu || isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)' }}><Settings size={15} /></button>
                {showGearMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 50, animation: 'dropIn 0.16s cubic-bezier(.34,1.4,.64,1) forwards' }}>
                    <div onClick={toggleBalanceVisibility} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>{isBalanceHidden ? '👁️' : '🙈'}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Hide balances</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>{isBalanceHidden ? 'Active across the app' : 'Tap to activate'}</p>
                      </div>
                      <div style={{ width: 36, height: 20, borderRadius: '999px', flexShrink: 0, background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ position: 'absolute', top: 2, left: isBalanceHidden ? 'calc(100% - 18px)' : '2px', width: 16, height: 16, borderRadius: '50%', background: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left 0.2s' }} />
                      </div>
                    </div>
                    <div onClick={() => { setShowCategoriesModal(true); setShowGearMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Tag size={14} color="var(--muted-foreground)" /></div>
                      <div><p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Categories</p><p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0', fontWeight: 500 }}>Manage &amp; edit</p></div>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => { if (activeTab === 'recurring') { setEditingRecurring(null); setShowRecurringModal(true); } else setShowAddModal(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '7px 14px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}><Plus size={14} />Add</button>
            </div>
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
            <BudgetChart transactions={allTransactions || []} showLast12Months={true} bpBalance={bpBalance} isBalanceHidden={isBalanceHidden} />
            <div style={{ padding: '1.75rem 1.5rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <StatCards cards={statCards} isBalanceHidden={isBalanceHidden} />
                  {totalRecurringFixed > 0 && <FixedVsDiscretionaryCard recurringFixed={totalRecurringFixed} discretionary={discretionary} totalExpenses={expensesTotal} recurringMonthlyTotal={recurringMonthlyTotal} entryTxns={entryTxns} isBalanceHidden={isBalanceHidden} />}
                  <BudgetChart transactions={[...txList, ...entryTxnsAsTx] as any[]} isBalanceHidden={isBalanceHidden} />
                  <BudgetInsights transactions={[...txList, ...entryTxnsAsTx] as any[]} allTransactions={allTransactions || []} totalIncome={totalIncome} totalExpenses={expensesTotal} savings={investments} isBalanceHidden={isBalanceHidden} />
                </div>
                <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <RecurringMiniTable recurringExpenses={recurringList} entryTxns={entryTxns} isBalanceHidden={isBalanceHidden} onViewAll={() => setActiveTab('recurring')} onAdd={() => { setEditingRecurring(null); setShowRecurringModal(true); }} />
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h2 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', margin: 0 }}>Transactions</h2>
                      <span onClick={() => setActiveTab('transactions')} style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>View all</span>
                    </div>
                    <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                      {combinedTxList.length === 0 ? <EmptyState onAdd={() => setShowAddModal(true)} message="No transactions yet this month" /> : combinedTxList.slice(0, 10).map((t: any) => renderRow(t))}
                    </div>
                    <div onClick={() => setActiveTab('yearly')} style={{ margin: '1rem', padding: '0.85rem 1rem', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'color-mix(in srgb, var(--color-blue-600) 12%, var(--background))', color: 'var(--color-blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={14} /></div>
                        <div><p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Annual Report</p><p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Year-over-year trends &amp; insights</p></div>
                      </div>
                      <ChevronRight size={14} color="var(--muted-foreground)" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <div style={{ padding: '1.75rem 1.5rem' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    All Transactions
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, marginLeft: 8, color: hasActiveFilter ? 'var(--color-orange-400)' : 'var(--muted-foreground)' }}>
                      {hasActiveFilter ? `${filteredTx.length} of ${combinedTxList.length}` : combinedTxList.length}
                    </span>
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => setShowFilters(v => !v)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', background: showFilters || hasActiveFilter ? 'var(--foreground)' : 'var(--muted)', color: showFilters || hasActiveFilter ? 'var(--background)' : 'var(--muted-foreground)' }}><SlidersHorizontal size={13} /></button>
                    <button onClick={() => setShowExportModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '5px 12px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', WebkitTapHighlightColor: 'transparent' }}><ArrowDown size={12} />Export</button>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: '100%', padding: '7px 32px 7px 30px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.8rem', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
                  {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}><X size={12} /></button>}
                </div>
                {showFilters && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['all', 'income', 'expense'] as const).map(t => (
                        <button key={t} onClick={() => setFilterType(t)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: '1.5px solid', WebkitTapHighlightColor: 'transparent', borderColor: filterType === t ? 'var(--foreground)' : 'var(--border)', background: filterType === t ? 'var(--foreground)' : 'transparent', color: filterType === t ? 'var(--background)' : 'var(--muted-foreground)' }}>
                          {t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expense'}
                        </button>
                      ))}
                    </div>
                    {(categories || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setFilterCatId(null)} style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filterCatId === null ? 'var(--foreground)' : 'var(--border)', background: filterCatId === null ? 'var(--foreground)' : 'transparent', color: filterCatId === null ? 'var(--background)' : 'var(--muted-foreground)' }}>All</button>
                        {(categories || []).map(c => (
                          <button key={c.id} onClick={() => setFilterCatId(filterCatId === Number(c.id) ? null : Number(c.id))} style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filterCatId === Number(c.id) ? 'var(--foreground)' : 'var(--border)', background: filterCatId === Number(c.id) ? 'var(--foreground)' : 'transparent', color: filterCatId === Number(c.id) ? 'var(--background)' : 'var(--muted-foreground)' }}>{c.name}</button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" placeholder="Min €" value={filterAmtMin} onChange={e => setFilterAmtMin(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>–</span>
                      <input type="number" placeholder="Max €" value={filterAmtMax} onChange={e => setFilterAmtMax(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      {hasActiveFilter && <button onClick={clearFilters} style={{ padding: '4px 10px', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600, border: 'none', background: 'var(--destructive)', color: 'var(--background)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear all</button>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 3, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
                        {([['date', 'Date'], ['amount', 'Amount']] as [SortKey, string][]).map(([key, label]) => (
                          <button key={key} onClick={() => setSortKey(key)} style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s', background: sortKey === key ? 'var(--card)' : 'transparent', color: sortKey === key ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: sortKey === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{label}</button>
                        ))}
                      </div>
                      <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}>
                        {sortDir === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {filteredTx.length === 0
                ? <EmptyState onAdd={() => setShowAddModal(true)} message={hasActiveFilter ? 'No transactions match your filters' : 'No transactions this month'} />
                : filteredTx.map((t: any) => renderRow(t))
              }
            </div>
          </div>
        )}

        {activeTab === 'yearly' && (
          <YearlyStats allTransactions={allTransactions || []} allRecurringEntries={(recurringExpenses || []).map(r => ({ recurringExpense: r, entries: [] }))} hideNav />
        )}

        {activeTab === 'recurring' && (
          <div style={{ padding: '1.75rem 1.5rem' }}>
            <RecurringExpensesTable recurringExpenses={recurringList} isMobile={false} isBalanceHidden={isBalanceHidden} onAdd={() => { setEditingRecurring(null); setShowRecurringModal(true); }} onEdit={e => { setEditingRecurring(e); setShowRecurringModal(true); }} onDelete={handleDeleteRecurringExpense} onDuplicate={handleDuplicateRecurringExpense} />
          </div>
        )}

        {showRecurringModal && <RecurringExpenseModal categories={categories || []} onClose={() => { setShowRecurringModal(false); setEditingRecurring(null); }} onSave={handleAddRecurringExpense} initialData={editingRecurring || undefined} />}
        {showExportModal && <ExportModal transactions={allTransactions || []} onClose={() => setShowExportModal(false)} />}
        {showAddModal && <AddTransactionModal categories={categories || []} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onSave={handleAddTransaction} initialData={editingTransaction || undefined} />}
        {showCategoriesModal && <ManageCategoriesModal categories={categories || []} onClose={() => setShowCategoriesModal(false)} onCreate={createCategory} onUpdate={updateCategory} onDelete={deleteCategory} />}
        <ActionSheet transaction={sheet?.tx ?? null} isRecurring={sheet?.isRecurring ?? false} isRecurringEntry={sheet?.isEntry ?? false} onClose={closeSheet} onEdit={handleSheetEdit} onDelete={handleSheetDelete} onDuplicate={handleSheetDuplicate} onToggleRecurring={handleSheetToggleRecurring} />
        <style>{`@keyframes dropIn { from { opacity:0; transform:scale(0.92) translateY(-6px); } to { opacity:1; transform:scale(1) translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ══════════════════════════════════════════════════════════════════════════

  if (activeTab === 'yearly') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.8rem 1rem' }}>
            <button onClick={() => setActiveTab('overview')} style={{ width: 34, height: 34, border: 'none', borderRadius: 10, background: 'var(--muted)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ChevronLeft size={16} /></button>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Annual Report</h1>
          </div>
        </div>
        <div style={{ paddingBottom: `calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)))` }}>
          <YearlyStats allTransactions={allTransactions || []} allRecurringEntries={(recurringExpenses || []).map(r => ({ recurringExpense: r, entries: [] }))} hideNav />
        </div>
        {showAddModal && <AddTransactionModal categories={categories || []} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onSave={handleAddTransaction} initialData={editingTransaction || undefined} />}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (activeTab === 'recurring') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setActiveTab('overview')} style={{ width: 34, height: 34, border: 'none', borderRadius: 10, background: 'var(--muted)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ChevronLeft size={16} /></button>
              <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Recurring Expenses</h1>
            </div>
            <button onClick={() => { setEditingRecurring(null); setShowRecurringModal(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}><Plus size={13} />Add</button>
          </div>
        </div>
        <div style={{ paddingBottom: `calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` }}>
          <RecurringExpensesTable recurringExpenses={recurringList} isMobile={true} isBalanceHidden={isBalanceHidden} onAdd={() => { setEditingRecurring(null); setShowRecurringModal(true); }} onEdit={e => { setEditingRecurring(e); setShowRecurringModal(true); }} onDelete={handleDeleteRecurringExpense} onDuplicate={handleDuplicateRecurringExpense} />
        </div>
        {showRecurringModal && <RecurringExpenseModal categories={categories || []} onClose={() => { setShowRecurringModal(false); setEditingRecurring(null); }} onSave={handleAddRecurringExpense} initialData={editingRecurring || undefined} />}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (activeTab === 'transactions') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ padding: '0.8rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setActiveTab('overview')} style={{ width: 34, height: 34, border: 'none', borderRadius: 10, background: 'var(--muted)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ChevronLeft size={16} /></button>
                <div>
                  <h1 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Transactions</h1>
                  <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: 0 }}>{monthLabel} · {hasActiveFilter ? `${filteredTx.length} of ` : ''}{combinedTxList.length} entries</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowFilters(v => !v)} style={{ width: 32, height: 32, border: 'none', borderRadius: 9, background: showFilters || hasActiveFilter ? 'var(--foreground)' : 'var(--muted)', color: showFilters || hasActiveFilter ? 'var(--background)' : 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><SlidersHorizontal size={13} /></button>
                <button onClick={() => setShowAddModal(true)} style={{ width: 32, height: 32, border: 'none', borderRadius: 9, background: 'var(--foreground)', color: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={14} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: showFilters ? '0.75rem' : 0 }}>
              <button onClick={goToPrevMonth} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ChevronLeft size={14} /></button>
              <button onClick={() => setSelectedMonth(new Date())} style={{ flex: 1, padding: '5px 0', border: 'none', background: isCurrentMonth ? 'var(--muted)' : 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', color: isCurrentMonth ? 'var(--foreground)' : 'var(--color-orange-400)', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </button>
              <button onClick={goToNextMonth} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ChevronRight size={14} /></button>
            </div>
            <div style={{ position: 'relative', marginTop: '0.6rem' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions…" style={{ width: '100%', padding: '8px 32px 8px 30px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.8rem', color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}><X size={12} /></button>}
            </div>
            {showFilters && (
              <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['all', 'income', 'expense'] as const).map(t => (
                    <button key={t} onClick={() => setFilterType(t)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: filterType === t ? 'var(--foreground)' : 'var(--border)', background: filterType === t ? 'var(--foreground)' : 'transparent', color: filterType === t ? 'var(--background)' : 'var(--muted-foreground)' }}>
                      {t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expense'}
                    </button>
                  ))}
                  {hasActiveFilter && <button onClick={clearFilters} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, border: 'none', background: 'var(--destructive)', color: 'var(--background)', cursor: 'pointer' }}>Clear</button>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" placeholder="Min €" value={filterAmtMin} onChange={e => setFilterAmtMin(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-sans)' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>–</span>
                  <input type="number" placeholder="Max €" value={filterAmtMax} onChange={e => setFilterAmtMax(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-sans)' }} />
                  <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} style={{ width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)', flexShrink: 0 }}>
                    {sortDir === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ paddingBottom: `calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` }}>
          <div style={{ background: 'var(--card)', borderRadius: 0, overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
            {filteredTx.length === 0
              ? <EmptyState onAdd={() => setShowAddModal(true)} message={hasActiveFilter ? 'No transactions match your filters' : 'No transactions this month'} />
              : filteredTx.map((t: any) => renderRow(t))
            }
          </div>
        </div>

        <ActionSheet transaction={sheet?.tx ?? null} isRecurring={sheet?.isRecurring ?? false} isRecurringEntry={sheet?.isEntry ?? false} onClose={closeSheet} onEdit={handleSheetEdit} onDelete={handleSheetDelete} onDuplicate={handleSheetDuplicate} onToggleRecurring={handleSheetToggleRecurring} />
        {showAddModal && <AddTransactionModal categories={categories || []} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onSave={handleAddTransaction} initialData={editingTransaction || undefined} />}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── MOBILE OVERVIEW ───────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Top Nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--background) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', paddingTop: 'env(safe-area-inset-top, 0px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={goToPrevMonth} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent' }}><ChevronLeft size={15} /></button>
            <button onClick={() => setSelectedMonth(new Date())} style={{ border: 'none', background: 'transparent', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', padding: '0 2px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.02em', color: isCurrentMonth ? 'var(--foreground)' : 'var(--color-orange-400)' }}>
                {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </button>
            <button onClick={goToNextMonth} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', WebkitTapHighlightColor: 'transparent' }}><ChevronRight size={15} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div ref={gearRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowGearMenu(v => !v)} style={{ width: 32, height: 32, border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', background: showGearMenu || isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', color: showGearMenu || isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)' }}><Settings size={14} /></button>
              {showGearMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 210, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden', zIndex: 50, animation: 'dropIn 0.16s cubic-bezier(.34,1.4,.64,1) forwards' }}>
                  <div onClick={toggleBalanceVisibility} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onTouchStart={e => (e.currentTarget.style.background = 'var(--accent)')} onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>{isBalanceHidden ? '👁️' : '🙈'}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Hide balances</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{isBalanceHidden ? 'Active' : 'Tap to activate'}</p>
                    </div>
                    <div style={{ width: 34, height: 19, borderRadius: '999px', flexShrink: 0, background: isBalanceHidden ? 'var(--foreground)' : 'var(--muted)', position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 2, left: isBalanceHidden ? 'calc(100% - 17px)' : '2px', width: 15, height: 15, borderRadius: '50%', background: isBalanceHidden ? 'var(--background)' : 'var(--muted-foreground)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                  <div onClick={() => { setShowCategoriesModal(true); setShowGearMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer' }} onTouchStart={e => (e.currentTarget.style.background = 'var(--accent)')} onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Tag size={14} color="var(--muted-foreground)" /></div>
                    <div><p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Categories</p><p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Manage &amp; edit</p></div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setShowAddModal(true)} style={{ width: 32, height: 32, border: 'none', borderRadius: 10, background: 'var(--foreground)', color: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}><Plus size={14} /></button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ paddingBottom: `calc(var(--mobile-nav-ui-height, 64px) + max(var(--mobile-nav-gap, 8px), env(safe-area-inset-bottom)) + 1rem)` }}>

        {/* Donut hero */}
        <div style={{ padding: '1.5rem 1rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <RevolutDonut spent={expensesTotal} income={totalIncome} isBalanceHidden={isBalanceHidden} month={monthLabel} categories={catBreakdown} />
          {catBreakdown.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px', marginTop: '1rem', maxWidth: 280 }}>
              {catBreakdown.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>{cat.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stat pills */}
        <div style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any, paddingBottom: 4 }}>
            {[
              { label: 'Income', value: totalIncome, delta: prevIncome > 0 ? totalIncome - prevIncome : undefined, color: 'var(--success)' },
              { label: 'Expenses', value: expensesTotal, delta: prevExpenses > 0 ? expensesTotal - prevExpenses : undefined, color: 'var(--destructive)' },
              { label: 'Savings', value: investments, delta: prevSavings > 0 ? investments - prevSavings : undefined, color: 'var(--color-purple-600)' },
              { label: 'Cash', value: cashBalance, color: cashBalance >= 0 ? 'var(--color-blue-600)' : 'var(--destructive)' },
              { label: 'Meal Vouchers', value: bpBalance, color: bpBalance >= 0 ? 'var(--color-orange-400)' : 'var(--destructive)' },
            ].map(({ label, value, delta, color }) => (
              <div key={label} style={{ flexShrink: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', minWidth: 90 }}>
                <p style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{label}</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 800, color, margin: 0, letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>{isBalanceHidden ? '€•••' : fmtEur(value)}</p>
                {delta !== undefined && !isBalanceHidden && (
                  <span style={{ fontSize: '0.55rem', fontWeight: 700, color: (label === 'Expenses' ? delta < 0 : delta > 0) ? 'var(--success)' : 'var(--destructive)' }}>
                    {delta > 0 ? '+' : ''}{fmtCompact(delta)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick nav tiles */}
        <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <NavTile icon={<Search size={14} />} label="Transactions" iconColor="var(--color-blue-600)" iconBg="color-mix(in srgb, var(--color-blue-600) 12%, var(--background))" value={String(combinedTxList.length)} valueColor="var(--foreground)" onClick={() => setActiveTab('transactions')} />
            <NavTile icon={<RefreshCw size={14} />} label="Recurring" iconColor="var(--color-orange-400)" iconBg="color-mix(in srgb, var(--color-orange-400) 12%, var(--background))" value={isBalanceHidden ? '€•••' : `-${fmtEur(recurringMonthlyTotal)}`} valueColor="var(--destructive)" onClick={() => setActiveTab('recurring')} />
            <NavTile icon={<BarChart2 size={14} />} label="Annual" iconColor="var(--color-purple-600)" iconBg="color-mix(in srgb, var(--color-purple-600) 12%, var(--background))" onClick={() => setActiveTab('yearly')} />
            <NavTile icon={<ArrowDown size={14} />} label="Export" iconColor="var(--muted-foreground)" iconBg="var(--muted)" onClick={() => setShowExportModal(true)} />
          </div>
        </div>

        {/* Monthly budget progress */}
        {totalIncome > 0 && (
          <div style={{ margin: '0 1rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0.9rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>Monthly budget</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: savingsRate >= 0 ? 'color-mix(in srgb, var(--success) 12%, var(--background))' : 'color-mix(in srgb, var(--destructive) 12%, var(--background))', color: savingsRate >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
                {isBalanceHidden ? '••%' : `${savingsRate >= 0 ? '+' : ''}${savingsRate}% saved`}
              </span>
            </div>
            <div style={{ height: 7, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden', marginBottom: '0.6rem' }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${totalIncome > 0 ? Math.min((expensesTotal / totalIncome) * 100, 100) : 0}%`, background: expensesTotal > totalIncome ? 'var(--destructive)' : 'var(--success)', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)' }}>Spent: {isBalanceHidden ? '€•••' : fmtEur(expensesTotal)}</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)' }}>Income: {isBalanceHidden ? '€•••' : fmtEur(totalIncome)}</span>
            </div>
          </div>
        )}

        {/* Fixed vs Discretionary */}
        {totalRecurringFixed > 0 && (
          <div style={{ margin: '0 1rem 1rem' }}>
            <FixedVsDiscretionaryCard recurringFixed={totalRecurringFixed} discretionary={discretionary} totalExpenses={expensesTotal} recurringMonthlyTotal={recurringMonthlyTotal} entryTxns={entryTxns} isBalanceHidden={isBalanceHidden} />
          </div>
        )}

        {/* Insights */}
        <div style={{ margin: '0 1rem 1rem' }}>
          <BudgetInsights transactions={[...txList, ...entryTxnsAsTx] as any[]} allTransactions={allTransactions || []} totalIncome={totalIncome} totalExpenses={expensesTotal} savings={investments} isBalanceHidden={isBalanceHidden} />
        </div>

        {/* Recent transactions */}
        <div style={{ margin: '0 1rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Recent transactions</h2>
              {entryTxns.length > 0 && <span style={{ fontSize: '0.6rem', color: 'var(--color-orange-400)', fontWeight: 600 }}>+{entryTxns.length} recurring</span>}
            </div>
            <button onClick={() => setActiveTab('transactions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 10px', background: 'var(--muted)', color: 'var(--muted-foreground)', border: 'none', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              View all <ChevronRightSmall size={11} />
            </button>
          </div>
          {combinedTxList.length === 0
            ? <EmptyState onAdd={() => setShowAddModal(true)} message="No transactions this month" compact />
            : combinedTxList.slice(0, 8).map((t: any) => renderRow(t))
          }
          {combinedTxList.length > 8 && (
            <div onClick={() => setActiveTab('transactions')} style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600, cursor: 'pointer', borderTop: '1px solid var(--border)', WebkitTapHighlightColor: 'transparent' }}>
              +{combinedTxList.length - 8} more transactions
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRecurringModal && <RecurringExpenseModal categories={categories || []} onClose={() => { setShowRecurringModal(false); setEditingRecurring(null); }} onSave={handleAddRecurringExpense} initialData={editingRecurring || undefined} />}
      {showExportModal && <ExportModal transactions={allTransactions || []} onClose={() => setShowExportModal(false)} />}
      {showAddModal && <AddTransactionModal categories={categories || []} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onSave={handleAddTransaction} initialData={editingTransaction || undefined} />}
      {showCategoriesModal && <ManageCategoriesModal categories={categories || []} onClose={() => setShowCategoriesModal(false)} onCreate={createCategory} onUpdate={updateCategory} onDelete={deleteCategory} />}

      {/* Action Sheet */}
      <ActionSheet transaction={sheet?.tx ?? null} isRecurring={sheet?.isRecurring ?? false} isRecurringEntry={sheet?.isEntry ?? false} onClose={closeSheet} onEdit={handleSheetEdit} onDelete={handleSheetDelete} onDuplicate={handleSheetDuplicate} onToggleRecurring={handleSheetToggleRecurring} />

      <style>{`
        @keyframes dropIn { from { opacity:0; transform:scale(0.92) translateY(-6px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin    { to   { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ── Wrap with ToastProvider ───────────────────────────────────────────────────
const BudgetPageWithToast: React.FC = () => (
  <ToastProvider>
    <BudgetPage />
  </ToastProvider>
);
export default BudgetPageWithToast;
