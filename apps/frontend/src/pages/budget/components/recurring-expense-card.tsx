// src/pages/Budget/components/recurring-expense-card.tsx

import { RecurringExpense, calculateAnnualAmount, calculateMonthlyAmount } from '@/lib/types/recurring';
import { RefreshCw } from 'lucide-react';
import React from 'react';

interface RecurringExpenseCardProps {
  recurringExpenses: RecurringExpense[];
  isBalanceHidden: boolean;
  onViewAll: () => void;
}

export const RecurringExpenseCard: React.FC<RecurringExpenseCardProps> = ({
  recurringExpenses,
  isBalanceHidden,
  onViewAll,
}) => {
  const activeExpenses = recurringExpenses.filter(e => e.isActive);

  if (activeExpenses.length === 0) return null;

  // Calcoli totali
  const totalMonthly = activeExpenses.reduce((sum, exp) => {
    return sum + calculateMonthlyAmount(exp.amount, exp.frequency, exp.customDays);
  }, 0);

  const totalAnnual = activeExpenses.reduce((sum, exp) => {
    return sum + calculateAnnualAmount(exp.amount, exp.frequency, exp.customDays);
  }, 0);

  const fmt = (n: number) => isBalanceHidden ? '€••••••' : `€${n.toFixed(2)}`;

  // Ordina per importo mensile (maggiore prima)
  const topExpenses = [...activeExpenses]
    .sort((a, b) => {
      const aMonthly = calculateMonthlyAmount(a.amount, a.frequency, a.customDays);
      const bMonthly = calculateMonthlyAmount(b.amount, b.frequency, b.customDays);
      return bMonthly - aMonthly;
    })
    .slice(0, 4);

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '10px',
            background: 'color-mix(in srgb, var(--color-orange-400) 12%, var(--background))',
            color: 'var(--color-orange-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <RefreshCw size={16} />
          </div>
          <div>
            <h3 style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: 0,
              marginBottom: '0.15rem'
            }}>
              Recurring Expenses
            </h3>
            <p style={{
              fontSize: '0.68rem',
              color: 'var(--muted-foreground)',
              margin: 0,
              fontWeight: 500
            }}>
              {activeExpenses.length} entry{activeExpenses.length !== 1 ? 's' : ''} active{activeExpenses.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        padding: '0 1rem 1rem'
      }}>
        <div style={{
          background: 'color-mix(in srgb, var(--color-blue-600) 8%, var(--background))',
          borderRadius: '12px',
          padding: '0.75rem'
        }}>
          <p style={{
            fontSize: '0.65rem',
            color: 'var(--muted-foreground)',
            margin: '0 0 4px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Monthly
          </p>
          <p style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--color-blue-600)',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            {fmt(totalMonthly)}
          </p>
        </div>
        <div style={{
          background: 'color-mix(in srgb, var(--color-purple-600) 8%, var(--background))',
          borderRadius: '12px',
          padding: '0.75rem'
        }}>
          <p style={{
            fontSize: '0.65rem',
            color: 'var(--muted-foreground)',
            margin: '0 0 4px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Annual
          </p>
          <p style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--color-purple-600)',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            {fmt(totalAnnual)}
          </p>
        </div>
      </div>

      {/* List */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {topExpenses.map((exp) => {
          const monthlyAmt = calculateMonthlyAmount(exp.amount, exp.frequency, exp.customDays);
          return (
            <div key={exp.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: 0,
                flex: 1
              }}>
                <RefreshCw size={12} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />
                <span style={{
                  color: 'var(--muted-foreground)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {exp.description}
                </span>
              </div>
              <span style={{
                fontWeight: 700,
                color: 'var(--foreground)',
                flexShrink: 0,
                marginLeft: '0.5rem'
              }}>
                {fmt(monthlyAmt)}
              </span>
            </div>
          );
        })}
        {activeExpenses.length > topExpenses.length && (
          <p style={{
            fontSize: '0.7rem',
            color: 'var(--muted-foreground)',
            margin: '0.25rem 0 0',
            fontWeight: 600
          }}>
            +{activeExpenses.length - topExpenses.length} more
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onViewAll}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--border)',
          border: 'none',
          background: 'var(--accent)',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--color-blue-600)',
          transition: 'background 0.15s',
          textAlign: 'left'
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
      >
        Manage recurring expenses →
      </button>
    </div>
  );
};
