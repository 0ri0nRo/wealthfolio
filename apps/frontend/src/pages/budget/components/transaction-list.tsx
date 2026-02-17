import { BudgetTransaction } from '@/lib/types/budget';
import { Pencil, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

interface TransactionListProps {
  transactions: BudgetTransaction[];
  onEdit: (transaction: BudgetTransaction) => void;
  onDelete: (id: string | number) => void;
}

type FilterType = 'all' | 'income' | 'expense';
type SortKey = 'date' | 'amount';

function useIsMobileList(bp = 640) {
  const [is, setIs] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setIs(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return is;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',     label: 'All'      },
  { key: 'income',  label: 'Income'   },
  { key: 'expense', label: 'Expenses' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'date',   label: 'Date'   },
  { key: 'amount', label: 'Amount' },
];

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onEdit,
  onDelete,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort]     = useState<SortKey>('date');
  const isMobile = useIsMobileList();

  const filtered = useMemo(() => {
    const base = filter === 'all'
      ? transactions
      : transactions.filter((t) => t.type === filter);

    return [...base].sort((a, b) => {
      if (sort === 'date')   return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sort === 'amount') return b.amount - a.amount;
      return 0;
    });
  }, [transactions, filter, sort]);

  return (
    <div>
      {/* ── Filter + Sort bar ─────────────────────────────────────────────── */}
      <div style={{
        padding: '0.6rem 1rem',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}>
        {/* Type filter pills */}
        <div style={{ display: 'flex', gap: '3px', background: '#f3f4f6', borderRadius: '8px', padding: '3px' }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                flex: isMobile ? 1 : undefined,
                padding: '5px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: filter === key ? '#111827' : 'transparent',
                color:      filter === key ? '#ffffff' : '#9ca3af',
                boxShadow:  filter === key ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div style={{ display: 'flex', gap: '3px', background: '#f3f4f6', borderRadius: '8px', padding: '3px' }}>
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              style={{
                flex: isMobile ? 1 : undefined,
                padding: '5px 9px',
                fontSize: '0.72rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: sort === key ? '#ffffff' : 'transparent',
                color:      sort === key ? '#111827' : '#9ca3af',
                boxShadow:  sort === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '2.5rem 1rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.82rem',
        }}>
          No transactions found
        </div>
      ) : (
        <div>
          {filtered.map((t, idx) => {
            const isIncome  = t.type === 'income';
            const amtColor  = isIncome ? '#16a34a' : '#dc2626';
            const amtPrefix = isIncome ? '+' : '−';

            const dateStr = new Date(t.date).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            });

            return (
              <div
                key={String(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.7rem 1rem',
                  borderBottom: idx < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  gap: '0.75rem',
                  transition: 'background 0.12s',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Category icon bubble */}
                <div style={{
                  width: 34, height: 34, borderRadius: '9px',
                  background: isIncome ? '#f0fdf4' : '#fef2f2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', flexShrink: 0,
                }}>
                  {t.category?.icon ?? (isIncome ? '💰' : '💸')}
                </div>

                {/* Description + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.82rem', fontWeight: 600, color: '#111827',
                    margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.description || t.category?.name || '—'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    {t.category && (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600,
                        padding: '1px 6px', borderRadius: '4px',
                        background: isIncome ? '#dcfce7' : '#fee2e2',
                        color:      isIncome ? '#15803d' : '#b91c1c',
                      }}>
                        {t.category.name}
                      </span>
                    )}
                    <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{dateStr}</span>
                  </div>
                </div>

                {/* Amount */}
                <p style={{
                  fontSize: '0.88rem', fontWeight: 700,
                  color: amtColor, margin: 0, flexShrink: 0, letterSpacing: '-0.01em',
                }}>
                  {amtPrefix}€{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>

                {/* Actions — show on row hover via parent hover state */}
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                  <button
                    onClick={() => onEdit(t)}
                    title="Edit"
                    style={{
                      width: 28, height: 28, border: 'none', borderRadius: '7px',
                      background: 'transparent', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#9ca3af', transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                      (e.currentTarget as HTMLButtonElement).style.color = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(t.id)}
                    title="Delete"
                    style={{
                      width: 28, height: 28, border: 'none', borderRadius: '7px',
                      background: 'transparent', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#9ca3af', transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2';
                      (e.currentTarget as HTMLButtonElement).style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
