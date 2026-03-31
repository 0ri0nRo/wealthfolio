// src/pages/Budget/components/recurring-expenses-table.tsx

import { RecurringExpense, calculateAnnualAmount, calculateMonthlyAmount, frequencyLabel } from '@/lib/types/recurring';
import { Copy, Edit2, Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface RecurringExpensesTableProps {
  recurringExpenses: RecurringExpense[];
  isMobile: boolean;
  isBalanceHidden: boolean;
  totalMonthlyIncome?: number; // optional — for % of income metric
  onAdd: () => void;
  onEdit: (expense: RecurringExpense) => void;
  onDelete: (id: string | number) => void;
  onDuplicate: (expense: RecurringExpense) => void;
}

// ── palette per categoria ─────────────────────────────────────────────────────
const CAT_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  default:   { bg: 'color-mix(in srgb, var(--color-blue-600) 10%, var(--background))',   text: 'var(--color-blue-600)',   bar: 'var(--color-blue-600)' },
  housing:   { bg: 'color-mix(in srgb, var(--color-blue-600) 10%, var(--background))',   text: 'var(--color-blue-600)',   bar: 'var(--color-blue-600)' },
  health:    { bg: 'color-mix(in srgb, var(--success) 10%, var(--background))',           text: 'var(--success)',           bar: 'var(--success)' },
  bills:     { bg: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))', text: 'var(--color-orange-400)', bar: 'var(--color-orange-400)' },
  transport: { bg: 'color-mix(in srgb, var(--color-purple-600) 10%, var(--background))', text: 'var(--color-purple-600)', bar: 'var(--color-purple-600)' },
  leisure:   { bg: 'color-mix(in srgb, var(--destructive) 8%, var(--background))',       text: 'var(--destructive)',       bar: 'var(--destructive)' },
  food:      { bg: 'color-mix(in srgb, var(--success) 8%, var(--background))',           text: 'var(--success)',           bar: 'var(--success)' },
};

function getCatColor(catName?: string) {
  if (!catName) return CAT_COLORS.default;
  const n = catName.toLowerCase();
  if (n.includes('rent') || n.includes('hous') || n.includes('affitto')) return CAT_COLORS.housing;
  if (n.includes('health') || n.includes('salut') || n.includes('medic') || n.includes('palest')) return CAT_COLORS.health;
  if (n.includes('bill') || n.includes('utili') || n.includes('bollen') || n.includes('elettr') || n.includes('gas') || n.includes('acqua')) return CAT_COLORS.bills;
  if (n.includes('transp') || n.includes('trasp') || n.includes('metro') || n.includes('auto') || n.includes('treno')) return CAT_COLORS.transport;
  if (n.includes('leisure') || n.includes('svago') || n.includes('sport') || n.includes('music') || n.includes('stream') || n.includes('netf') || n.includes('spot')) return CAT_COLORS.leisure;
  if (n.includes('food') || n.includes('cibo') || n.includes('spesa') || n.includes('meal')) return CAT_COLORS.food;
  return CAT_COLORS.default;
}


export const RecurringExpensesTable: React.FC<RecurringExpensesTableProps> = ({
  recurringExpenses,
  isMobile,
  isBalanceHidden,
  totalMonthlyIncome,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const activeExpenses   = recurringExpenses.filter(e => e.isActive);
  const inactiveExpenses = recurringExpenses.filter(e => !e.isActive);

  const totalMonthly = useMemo(() =>
    activeExpenses.reduce((s, e) => s + calculateMonthlyAmount(e.amount, e.frequency, e.customDays), 0),
    [activeExpenses]);

  const totalAnnual = useMemo(() =>
    activeExpenses.reduce((s, e) => s + calculateAnnualAmount(e.amount, e.frequency, e.customDays), 0),
    [activeExpenses]);

  const pctOfIncome = totalMonthlyIncome && totalMonthlyIncome > 0
    ? Math.round((totalMonthly / totalMonthlyIncome) * 100)
    : null;

  // Next expense to bill (closest startDate day-of-month from today)
  const nextExpense = useMemo(() => {
    if (!activeExpenses.length) return null;
    return activeExpenses.reduce((a, b) => a.amount > b.amount ? a : b); // simplification
  }, [activeExpenses]);

  // Category breakdown for bar chart
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; monthly: number; color: typeof CAT_COLORS[string] }>();
    activeExpenses.forEach(e => {
      const catName = e.category?.name ?? 'Other';
      const monthly = calculateMonthlyAmount(e.amount, e.frequency, e.customDays);
      const ex = map.get(catName);
      if (ex) ex.monthly += monthly;
      else map.set(catName, { name: catName, monthly, color: getCatColor(catName) });
    });
    return [...map.values()].sort((a, b) => b.monthly - a.monthly);
  }, [activeExpenses]);

  const fmt = (n: number) => isBalanceHidden ? '€••••' : `€${n.toFixed(2)}`;
  const fmtShort = (n: number) => isBalanceHidden ? '€••••' : `€${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;

  const sinceLabel = (startDate?: string) => {
    if (!startDate) return null;
    const d = new Date(startDate);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // ── Shared card renderer ──────────────────────────────────────────────────
  const renderCard = (expense: RecurringExpense, inactive = false) => {
    const monthly  = calculateMonthlyAmount(expense.amount, expense.frequency, expense.customDays);
    const annual   = calculateAnnualAmount(expense.amount, expense.frequency, expense.customDays);
    const isExpanded = expandedId === expense.id;
    const color    = getCatColor(expense.category?.name);
    const barPct   = totalMonthly > 0 ? Math.round((monthly / totalMonthly) * 100) : 0;
    const since    = sinceLabel(expense.startDate);

    return (
      <div key={expense.id} style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Main row */}
        <div
          onClick={() => isMobile && setExpandedId(isExpanded ? null : expense.id)}
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '44px 1fr auto' : '44px 1fr 120px 120px 120px 120px',
            alignItems: 'center',
            gap: isMobile ? '12px' : '0',
            padding: isMobile ? '14px 1rem' : '14px 1.25rem',
            background: inactive ? 'var(--accent)' : 'var(--card)',
            opacity: inactive ? 0.55 : 1,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!isMobile && !inactive) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; }}
          onMouseLeave={e => { if (!isMobile) (e.currentTarget as HTMLDivElement).style.background = inactive ? 'var(--accent)' : 'var(--card)'; }}
        >
          {/* Icon */}
          <div style={{ width: 44, height: 44, borderRadius: 12, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {expense.category?.icon ?? '💰'}
          </div>

          {/* Description + meta */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
              {expense.description}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {expense.category?.name && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: color.bg, color: color.text }}>
                  {expense.category.name}
                </span>
              )}
              <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                {frequencyLabel(expense.frequency, expense.customDays)}
              </span>
              {since && (
                <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>since {since}</span>
              )}
            </div>
            {/* Progress bar — weight vs total */}
            {!inactive && (
              <div style={{ marginTop: 7, height: 3, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden', maxWidth: isMobile ? '100%' : 280 }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: color.bar, borderRadius: 999, transition: 'width 0.4s ease' }} />
              </div>
            )}
          </div>

          {/* Desktop columns */}
          {!isMobile && (
            <>
              <div style={{ textAlign: 'right', paddingRight: '1rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Per occurrence</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)' }}>{fmt(expense.amount)}</div>
              </div>
              <div style={{ textAlign: 'right', paddingRight: '1rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monthly</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-blue-600)' }}>{fmtShort(monthly)}</div>
              </div>
              <div style={{ textAlign: 'right', paddingRight: '1rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Annual</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-purple-600)' }}>{fmtShort(annual)}</div>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                {[
                  { icon: <Edit2 size={11} />, fn: () => onEdit(expense), danger: false },
                  { icon: <Copy size={11} />,  fn: () => onDuplicate(expense), danger: false },
                  { icon: <Trash2 size={11} />, fn: () => onDelete(expense.id), danger: true },
                ].map(({ icon, fn, danger }, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); fn(); }}
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, cursor: 'pointer', background: 'var(--muted)', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? 'color-mix(in srgb, var(--destructive) 12%, var(--background))' : 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = danger ? 'var(--destructive)' : 'var(--foreground)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)'; }}
                  >{icon}</button>
                ))}
              </div>
            </>
          )}

          {/* Mobile chevron */}
          {isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--destructive)' }}>-{fmtShort(monthly)}/mo</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>{fmtShort(annual)}/yr</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{isExpanded ? '▲' : '▼'}</div>
            </div>
          )}
        </div>

        {/* Mobile expanded */}
        {isMobile && isExpanded && (
          <div style={{ padding: '1rem', background: 'var(--accent)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Per occurrence', value: fmt(expense.amount), color: 'var(--foreground)' },
                { label: 'Monthly',        value: fmtShort(monthly),   color: 'var(--color-blue-600)' },
                { label: 'Annual',         value: fmtShort(annual),    color: 'var(--color-purple-600)' },
              ].map(({ label, value, color: c }) => (
                <div key={label} style={{ background: 'var(--card)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: c }}>{value}</div>
                </div>
              ))}
            </div>
            {expense.notes && (
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Notes</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--foreground)', fontStyle: 'italic' }}>{expense.notes}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onEdit(expense)} style={{ flex: 1, padding: '0.6rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Edit2 size={12} /> Edit
              </button>
              <button onClick={() => onDuplicate(expense)} style={{ flex: 1, padding: '0.6rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Copy size={12} /> Copy
              </button>
              <button onClick={() => onDelete(expense.id)} style={{ flex: 1, padding: '0.6rem', background: 'color-mix(in srgb, var(--destructive) 10%, var(--background))', border: '1px solid var(--destructive)', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, color: 'var(--destructive)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (activeExpenses.length === 0 && inactiveExpenses.length === 0) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, margin: isMobile ? '0 1rem' : 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', gap: '0.75rem', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💰</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', fontWeight: 500, margin: 0 }}>No recurring expenses yet</p>
        <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={12} /> Add recurring expense
        </button>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: isMobile ? '0 1rem' : 0 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>Recurring expenses</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: '2px 0 0', fontWeight: 500 }}>
            {activeExpenses.length} active{inactiveExpenses.length > 0 ? ` · ${inactiveExpenses.length} paused` : ''}
          </p>
        </div>
        <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: isMobile ? '7px 12px' : '8px 16px', background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={13} />{!isMobile ? 'Add recurring expense' : 'Add'}
        </button>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      {activeExpenses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
          {[
            {
              label: 'Monthly total',
              value: isBalanceHidden ? '€••••••' : `€${totalMonthly.toFixed(2)}`,
              sub: `${activeExpenses.length} items`,
              color: 'var(--color-blue-600)',
            },
            {
              label: 'Annual projection',
              value: isBalanceHidden ? '€••••••' : `€${totalAnnual.toFixed(2)}`,
              sub: 'all active',
              color: 'var(--color-purple-600)',
            },
            {
              label: '% of income',
              value: pctOfIncome !== null ? `${pctOfIncome}%` : '—',
              sub: 'fixed costs',
              color: pctOfIncome !== null && pctOfIncome > 50 ? 'var(--destructive)' : 'var(--color-orange-400)',
            },
            {
              label: 'Largest item',
              value: nextExpense ? (isBalanceHidden ? '€••••' : `€${nextExpense.amount.toFixed(2)}`) : '—',
              sub: nextExpense?.description ?? '',
              color: 'var(--foreground)',
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.9rem 1rem' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 800, color, letterSpacing: '-0.025em', marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Category bar chart ──────────────────────────────────────────────── */}
      {catBreakdown.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>By category</h3>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>monthly</span>
          </div>
          <div style={{ padding: '0.85rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catBreakdown.map(cat => {
              const pct = totalMonthly > 0 ? (cat.monthly / totalMonthly) * 100 : 0;
              return (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: isMobile ? 80 : 100, fontSize: '0.72rem', fontWeight: 600, color: 'var(--foreground)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                  <div style={{ flex: 1, height: 20, background: 'var(--muted)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: cat.color.bar, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, transition: 'width 0.5s ease', minWidth: pct > 5 ? undefined : 0 }}>
                      {pct > 12 && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
                          {isBalanceHidden ? '••' : `€${cat.monthly.toFixed(0)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 70, textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>
                    {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>

        {/* Desktop column headers */}
        {!isMobile && activeExpenses.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 120px 120px 120px 120px', gap: 0, padding: '0.65rem 1.25rem', background: 'var(--muted)', borderBottom: '1px solid var(--border)', fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div />
            <div>Description</div>
            <div style={{ textAlign: 'right', paddingRight: '1rem' }}>Per occurrence</div>
            <div style={{ textAlign: 'right', paddingRight: '1rem' }}>Monthly</div>
            <div style={{ textAlign: 'right', paddingRight: '1rem' }}>Annual</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}

        {/* Active */}
        {activeExpenses.map(e => renderCard(e, false))}

        {/* Totals footer */}
        {activeExpenses.length > 0 && (
          <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : '44px 1fr 120px 120px 120px 120px', alignItems: 'center', justifyContent: isMobile ? 'space-between' : undefined, gap: 0, padding: isMobile ? '0.85rem 1rem' : '0.85rem 1.25rem', background: 'var(--accent)', borderTop: '1px solid var(--border)' }}>
            {!isMobile && <div />}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total ({activeExpenses.length} items)
            </div>
            {!isMobile && <div />}
            <div style={{ textAlign: isMobile ? undefined : 'right', paddingRight: isMobile ? 0 : '1rem' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{isMobile ? 'Monthly' : ''}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-blue-600)' }}>
                {isBalanceHidden ? '€••••••' : `€${totalMonthly.toFixed(2)}`}
                {isMobile && <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500, marginLeft: 4 }}>/mo</span>}
              </div>
            </div>
            {!isMobile && (
              <div style={{ textAlign: 'right', paddingRight: '1rem' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-purple-600)' }}>
                  {isBalanceHidden ? '€••••••' : `€${totalAnnual.toFixed(2)}`}
                </div>
              </div>
            )}
            {isMobile && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>Annual</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-purple-600)' }}>
                  {isBalanceHidden ? '€••••••' : `€${totalAnnual.toFixed(2)}`}
                </div>
              </div>
            )}
            {!isMobile && <div />}
          </div>
        )}

        {/* Inactive */}
        {inactiveExpenses.length > 0 && (
          <>
            <div style={{ padding: '0.65rem 1.25rem', background: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Paused ({inactiveExpenses.length})
              </span>
            </div>
            {inactiveExpenses.map(e => renderCard(e, true))}
          </>
        )}
      </div>
    </div>
  );
};
