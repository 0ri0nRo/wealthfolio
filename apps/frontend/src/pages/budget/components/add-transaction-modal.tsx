// src/pages/Budget/components/AddTransactionModal.tsx
import { BudgetCategory, CreateBudgetTransactionInput } from '@/lib/types/budget';
import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface AddTransactionModalProps {
  categories: BudgetCategory[];
  onClose: () => void;
  onSave: (transaction: CreateBudgetTransactionInput) => void;
  initialData?: Partial<CreateBudgetTransactionInput>;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  categories = [],
  onClose,
  onSave,
  initialData,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<CreateBudgetTransactionInput>({
    type: initialData?.type || 'expense',
    categoryId: initialData?.categoryId || 0,
    amount: initialData?.amount || 0,
    description: initialData?.description || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Blocca lo scroll del body su iOS ──────────────────────────────────────
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const filteredCategories = categories.filter(
    c => c.type === formData.type && (c.isActive ?? c.is_active)
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) newErrors.description = 'Description required';
    if (!formData.categoryId) newErrors.categoryId = 'Please select a category';
    if (formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!formData.date) newErrors.date = 'Date required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSave(formData);
  };

  const updateField = <K extends keyof CreateBudgetTransactionInput>(
    field: K,
    value: CreateBudgetTransactionInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0 1rem',
    height: 48,
    borderRadius: '12px',
    background: 'var(--muted)',
    border: '1.5px solid transparent',
    color: 'var(--foreground)',
    fontSize: '16px', // >= 16px previene lo zoom su iOS Safari
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
    appearance: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--muted-foreground)',
    marginBottom: '6px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    color: '#dc2626',
    marginTop: '4px',
    fontWeight: 500,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        // Centrato sia verticalmente che orizzontalmente
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Padding che rispetta la safe area di iPhone (notch + home indicator)
        padding: `max(env(safe-area-inset-top, 0px), 16px) 16px max(env(safe-area-inset-bottom, 0px), 16px)`,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal card centrata */}
      <div
        ref={scrollRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 460,
          // Scorre internamente se il contenuto supera l'altezza disponibile
          // (es. tastiera aperta su iPhone che riduce il viewport)
          maxHeight: '88dvh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          background: 'var(--card)',
          borderRadius: '20px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header sticky */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.1rem 1.25rem',
          position: 'sticky',
          top: 0,
          background: 'var(--card)',
          zIndex: 2,
          borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--foreground)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            {initialData ? 'Edit Transaction' : 'New Transaction'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 30, height: 30,
              borderRadius: '50%',
              background: 'var(--muted)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '1.1rem 1.25rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Type toggle */}
          <div>
            <label style={labelStyle}>Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(['income', 'expense'] as const).map(t => {
                const isSelected = formData.type === t;
                const color = t === 'income' ? '#16a34a' : '#dc2626';
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { updateField('type', t); updateField('categoryId', 0); }}
                    style={{
                      padding: '11px',
                      borderRadius: '12px',
                      border: `1.5px solid ${isSelected ? color : 'transparent'}`,
                      background: isSelected
                        ? `color-mix(in srgb, ${color} 10%, var(--background))`
                        : 'var(--muted)',
                      color: isSelected ? color : 'var(--muted-foreground)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      WebkitTapHighlightColor: 'transparent',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {t === 'income' ? '↑ Income' : '↓ Expense'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={formData.categoryId}
              onChange={e => updateField('categoryId', parseInt(e.target.value))}
              style={{
                ...inputStyle,
                border: `1.5px solid ${errors.categoryId ? '#dc2626' : 'transparent'}`,
                paddingRight: '2.5rem',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
              }}
            >
              <option value="0">Select category…</option>
              {filteredCategories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p style={errorStyle}>{errors.categoryId}</p>}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              value={formData.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="e.g., Grocery shopping"
              style={{
                ...inputStyle,
                border: `1.5px solid ${errors.description ? '#dc2626' : 'transparent'}`,
              }}
            />
            {errors.description && <p style={errorStyle}>{errors.description}</p>}
          </div>

          {/* Amount + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Amount</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-foreground)',
                  fontSize: '0.9rem', fontWeight: 600,
                  pointerEvents: 'none',
                }}>€</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={formData.amount || ''}
                  onChange={e => updateField('amount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  style={{
                    ...inputStyle,
                    paddingLeft: '2rem',
                    border: `1.5px solid ${errors.amount ? '#dc2626' : 'transparent'}`,
                  }}
                />
              </div>
              {errors.amount && <p style={errorStyle}>{errors.amount}</p>}
            </div>

            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => updateField('date', e.target.value)}
                style={{
                  ...inputStyle,
                  border: `1.5px solid ${errors.date ? '#dc2626' : 'transparent'}`,
                }}
              />
              {errors.date && <p style={errorStyle}>{errors.date}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>
              Notes{' '}
              <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={e => updateField('notes', e.target.value)}
              rows={2}
              placeholder="Additional information…"
              style={{
                ...inputStyle,
                height: 'auto',
                padding: '0.75rem 1rem',
                resize: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, height: 46, borderRadius: '12px',
                background: 'var(--muted)', color: 'var(--foreground)',
                border: 'none', fontSize: '0.88rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2, height: 46, borderRadius: '12px',
                background: 'var(--foreground)', color: 'var(--background)',
                border: 'none', fontSize: '0.88rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {initialData ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
