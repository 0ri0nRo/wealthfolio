// src/pages/Budget/components/recurring-expenses-table.tsx

import { RecurringExpense, calculateAnnualAmount, calculateMonthlyAmount, frequencyLabel } from '@/lib/types/recurring';
import { Copy, Edit2, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

interface RecurringExpensesTableProps {
  recurringExpenses: RecurringExpense[];
  isMobile: boolean;
  isBalanceHidden: boolean;
  onAdd: () => void;
  onEdit: (expense: RecurringExpense) => void;
  onDelete: (id: string | number) => void;
  onDuplicate: (expense: RecurringExpense) => void;
}

export const RecurringExpensesTable: React.FC<RecurringExpensesTableProps> = ({
  recurringExpenses,
  isMobile,
  isBalanceHidden,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const activeExpenses = recurringExpenses.filter(e => e.isActive);
  const inactiveExpenses = recurringExpenses.filter(e => !e.isActive);

  // Calcoli totali
  const totalMonthly = activeExpenses.reduce((sum, exp) => {
    return sum + calculateMonthlyAmount(exp.amount, exp.frequency, exp.customDays);
  }, 0);

  const totalAnnual = activeExpenses.reduce((sum, exp) => {
    return sum + calculateAnnualAmount(exp.amount, exp.frequency, exp.customDays);
  }, 0);

  const fmt = (n: number) => isBalanceHidden ? '€••••••' : `€${n.toFixed(2)}`;

  const renderTable = (expenses: RecurringExpense[], showInactive = false) => {
    if (expenses.length === 0) return null;

    return (
      <div key={showInactive ? 'inactive' : 'active'}>
        {showInactive && (
          <div style={{ padding: '1rem 1.25rem', background: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recurring deactivated ({inactiveExpenses.length})
            </h3>
          </div>
        )}
        {expenses.map((expense) => {
          const monthlyAmt = calculateMonthlyAmount(expense.amount, expense.frequency, expense.customDays);
          const annualAmt = calculateAnnualAmount(expense.amount, expense.frequency, expense.customDays);
          const isExpanded = expandedId === expense.id;

          return (
            <div key={expense.id}>
              {/* Main row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                style={{
                  display: isMobile ? 'flex' : 'grid',
                  gridTemplateColumns: isMobile ? undefined : '0.5fr 1.5fr 1fr 1fr 1fr 0.8fr',
                  alignItems: 'center',
                  gap: isMobile ? '0.75rem' : 0,
                  padding: isMobile ? '1rem' : '1rem 1.25rem',
                  borderBottom: '1px solid var(--border)',
                  background: showInactive ? 'var(--muted)' : 'var(--card)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  opacity: expense.isActive ? 1 : 0.6,
                }}
                onMouseEnter={e => {
                  if (!isMobile && expense.isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isMobile) {
                    (e.currentTarget as HTMLDivElement).style.background = showInactive ? 'var(--muted)' : 'var(--card)';
                  }
                }}
              >
                {/* Status badge */}
                {!isMobile && (
                  <div style={{
                    fontSize: '1.2rem',
                    opacity: expense.isActive ? 1 : 0.4,
                    marginRight: '0.5rem'
                  }}>
                    {expense.category?.name?.[0] || '💰'}
                  </div>
                )}

                {/* Descrizione */}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: isMobile ? '0.9rem' : '0.85rem',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {expense.description}
                  </p>
                  {isMobile && (
                    <p style={{
                      fontSize: '0.7rem',
                      color: 'var(--muted-foreground)',
                      margin: '2px 0 0',
                      fontWeight: 500
                    }}>
                      {expense.category?.name || '—'} · {frequencyLabel(expense.frequency, expense.customDays)}
                    </p>
                  )}
                </div>

                {/* Importo (una tantum) */}
                {!isMobile && (
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    {fmt(expense.amount)}
                  </div>
                )}

                {/* Frequenza */}
                {!isMobile && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                    {frequencyLabel(expense.frequency, expense.customDays)}
                  </div>
                )}

                {/* Mensile */}
                {!isMobile && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 500 }}>
                      Monthly
                    </p>
                    <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                      {fmt(monthlyAmt)}
                    </p>
                  </div>
                )}

                {/* Annual */}
                {!isMobile && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 500 }}>
                      Annual
                    </p>
                    <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-purple-600)', margin: 0 }}>
                      {fmt(annualAmt)}
                    </p>
                  </div>
                )}

                {/* Actions (desktop) */}
                {!isMobile && (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onEdit(expense);
                      }}
                      title="Modifica"
                      style={{
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: 'var(--muted)',
                        color: 'var(--muted-foreground)',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)';
                      }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDuplicate(expense);
                      }}
                      title="Duplica"
                      style={{
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: 'var(--muted)',
                        color: 'var(--muted-foreground)',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)';
                      }}
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(expense.id);
                      }}
                      title="Elimina"
                      style={{
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: 'var(--muted)',
                        color: 'var(--muted-foreground)',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--destructive) 12%, var(--background))';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--destructive)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)';
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}

                {/* Expand indicator (mobile) */}
                {isMobile && (
                  <div style={{ fontSize: '1.2rem', color: 'var(--muted-foreground)' }}>
                    {isExpanded ? '▼' : '▶'}
                  </div>
                )}
              </div>

              {/* Expanded row (mobile) */}
              {isMobile && isExpanded && (
                <div style={{
                  padding: '1rem',
                  background: 'var(--accent)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div>
                      <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>
                        Importo
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                        {fmt(expense.amount)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>
                        Mensile
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-blue-600)', margin: 0 }}>
                        {fmt(monthlyAmt)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>
                        Annuale
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-purple-600)', margin: 0 }}>
                        {fmt(annualAmt)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>
                        Categoria
                      </p>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                        {expense.category?.name || '—'}
                      </p>
                    </div>
                  </div>
                  {expense.notes && (
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>
                        Note
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--foreground)', margin: 0, fontStyle: 'italic' }}>
                        {expense.notes}
                      </p>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onEdit(expense);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Edit2 size={12} /> Modifica
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(expense.id);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        background: 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
                        border: '1px solid var(--destructive)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--destructive)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Trash2 size={12} /> Elimina
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', margin: isMobile ? '0 1rem' : 0 }}>
      {/* Header */}
      <div style={{ padding: isMobile ? '1rem' : '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, marginBottom: '0.25rem' }}>
            Recurring Expenses
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0, fontWeight: 500 }}>
            {activeExpenses.length} recurring{activeExpenses.length !== 1 ? 's' : ''} active{activeExpenses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: isMobile ? '6px 12px' : '8px 16px',
            background: 'var(--foreground)',
            color: 'var(--background)',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Plus size={14} />
          {!isMobile && 'Add Recurring Expense'}
        </button>
      </div>

      {/* Summary (desktop only) */}
      {!isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          padding: '1rem 1.25rem',
          background: 'var(--accent)',
          borderBottom: '1px solid var(--border)'
        }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Monthly
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-blue-600)', margin: 0, letterSpacing: '-0.02em' }}>
              {fmt(totalMonthly)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Annual
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-purple-600)', margin: 0, letterSpacing: '-0.02em' }}>
              {fmt(totalAnnual)}
            </p>
          </div>
        </div>
      )}

      {/* Mobile summary */}
      {isMobile && activeExpenses.length > 0 && (
        <div style={{
          padding: '1rem',
          background: 'var(--accent)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: '1rem'
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>
              Monthly
            </p>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-blue-600)', margin: 0 }}>
              {fmt(totalMonthly)}
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>
              Annual
            </p>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-purple-600)', margin: 0 }}>
              {fmt(totalAnnual)}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {activeExpenses.length === 0 && inactiveExpenses.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          gap: '0.75rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            💰
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0, fontWeight: 500 }}>
            No recurring expenses
          </p>
          <button
            onClick={onAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '6px 16px',
              background: 'var(--foreground)',
              color: 'var(--background)',
              border: 'none',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Plus size={12} /> Add Recurring Expense
          </button>
        </div>
      ) : (
        <>
          {/* Desktop header row */}
          {!isMobile && activeExpenses.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '0.5fr 1.5fr 1fr 1fr 1fr 0.8fr',
              gap: 0,
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--muted)',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--muted-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              position: 'sticky',
              top: 0
            }}>
              <div></div>
              <div>Description</div>
              <div>Amount</div>
              <div>Frequency</div>
              <div style={{ textAlign: 'right' }}>Monthly</div>
              <div style={{ textAlign: 'right' }}>Annual</div>
            </div>
          )}
          {renderTable(activeExpenses)}
          {inactiveExpenses.length > 0 && renderTable(inactiveExpenses, true)}
        </>
      )}
    </div>
  );
};
