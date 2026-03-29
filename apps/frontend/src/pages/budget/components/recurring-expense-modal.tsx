// src/pages/Budget/components/recurring-expense-modal.tsx

import { BudgetCategory } from '@/lib/types/budget';
import {
    RecurrenceFrequency,
    RecurringExpense,
    calculateAnnualAmount,
    calculateMonthlyAmount,
} from '@/lib/types/recurring';
import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface RecurringExpenseModalProps {
  categories: BudgetCategory[];
  onClose: () => void;
  onSave: (data: Partial<RecurringExpense>) => Promise<void>;
  initialData?: RecurringExpense;
}

export const RecurringExpenseModal: React.FC<RecurringExpenseModalProps> = ({
  categories,
  onClose,
  onSave,
  initialData,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only expense categories, active ones
  const expenseCategories = categories.filter(
    c => c.type === 'expense' && (c.isActive ?? (c as any).is_active)
  );

  // ── State ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    description: initialData?.description ?? '',
    amount: initialData?.amount?.toString() ?? '',
    categoryId: initialData?.categoryId?.toString() ??
      (expenseCategories[0]?.id?.toString() ?? ''),
    frequency: (initialData?.frequency ?? 'monthly') as RecurrenceFrequency,
    customDays: initialData?.customDays?.toString() ?? '',
    startDate:
      typeof initialData?.startDate === 'string'
        ? initialData.startDate
        : initialData?.startDate
        ? new Date(initialData.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate
      ? typeof initialData.endDate === 'string'
        ? initialData.endDate
        : new Date(initialData.endDate).toISOString().split('T')[0]
      : '',
    notes: initialData?.notes ?? '',
    isActive: initialData?.isActive ?? true,
  });

  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(false);
  const [showEndDate, setShowEndDate] = useState(!!initialData?.endDate);

  // Lock body scroll (same as AddTransactionModal)
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth    = document.body.style.width;
    const scrollY          = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width    = '100%';
    document.body.style.top      = `-${scrollY}px`;

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width    = originalWidth;
      document.body.style.top      = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // ── Validation ───────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.description.trim())
      newErrors.description = 'Description required';
    if (!form.amount || parseFloat(form.amount) <= 0)
      newErrors.amount = 'Enter a valid amount';
    if (!form.categoryId)
      newErrors.categoryId = 'Please select a category';
    if (!form.startDate)
      newErrors.startDate = 'Start date required';
    if (
      form.frequency === 'custom' &&
      (!form.customDays || parseInt(form.customDays) <= 0)
    )
      newErrors.customDays = 'Enter number of days';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Calculations ─────────────────────────────────────────────────────
  const amount     = parseFloat(form.amount) || 0;
  const customDays = form.customDays ? parseInt(form.customDays) : undefined;
  const monthlyAmount = calculateMonthlyAmount(amount, form.frequency, customDays);
  const annualAmount  = calculateAnnualAmount(amount, form.frequency, customDays);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key])
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: Partial<RecurringExpense> = {
        description: form.description,
        amount:      parseFloat(form.amount),
        categoryId:  parseInt(form.categoryId),
        frequency:   form.frequency as RecurrenceFrequency,
        customDays:  form.frequency === 'custom' ? parseInt(form.customDays) : undefined,
        startDate:   form.startDate,
        endDate:     showEndDate ? (form.endDate || null) : null,
        notes:       form.notes || undefined,
        isActive:    form.isActive,
      };
      await onSave(payload);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles (mirrors AddTransactionModal) ───────────────────────
  const inputStyle: React.CSSProperties = {
    width:           '100%',
    padding:         '0 1rem',
    height:          48,
    borderRadius:    '12px',
    background:      'var(--muted)',
    border:          '1.5px solid transparent',
    color:           'var(--foreground)',
    fontSize:        '16px',           // prevents iOS zoom
    fontFamily:      'var(--font-sans)',
    outline:         'none',
    transition:      'border-color 0.15s',
    boxSizing:       'border-box',
    WebkitAppearance: 'none',
    appearance:      'none',
  };

  const inputError: React.CSSProperties = { ...inputStyle, border: '1.5px solid var(--destructive)' };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    paddingRight:      '2.5rem',
    backgroundImage:   `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat:  'no-repeat',
    backgroundPosition:'right 14px center',
    cursor:            'pointer',
  };

  const selectError: React.CSSProperties = { ...selectStyle, border: '1.5px solid var(--destructive)' };

  const labelStyle: React.CSSProperties = {
    display:       'block',
    fontSize:      '0.72rem',
    fontWeight:    600,
    color:         'var(--muted-foreground)',
    marginBottom:  '6px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  const errorStyle: React.CSSProperties = {
    fontSize:   '0.72rem',
    color:      'var(--destructive)',
    marginTop:  '4px',
    fontWeight: 500,
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset:    0,
        zIndex:   50,
        display:  'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding: `max(env(safe-area-inset-top, 0px), 16px) 16px max(env(safe-area-inset-bottom, 0px), 16px)`,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:        'absolute',
          inset:           0,
          background:      'rgba(0,0,0,0.5)',
          backdropFilter:  'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div
        ref={scrollRef}
        style={{
          position:      'relative',
          width:         '100%',
          maxWidth:      460,
          maxHeight:     '88dvh',
          overflowY:     'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          background:    'var(--card)',
          borderRadius:  '20px',
          boxShadow:     '0 8px 48px rgba(0,0,0,0.22)',
          border:        '1px solid var(--border)',
        }}
      >
        {/* ── Sticky Header ─────────────────────────────────────────── */}
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         '1.1rem 1.25rem',
          position:        'sticky',
          top:             0,
          background:      'var(--card)',
          zIndex:          2,
          borderBottom:    '1px solid var(--border)',
        }}>
          <h3 style={{
            fontSize:      '1rem',
            fontWeight:    700,
            color:         'var(--foreground)',
            margin:        0,
            letterSpacing: '-0.01em',
          }}>
            {initialData ? 'Edit recurring expense' : 'New recurring expense'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              width:      30,
              height:     30,
              borderRadius: '50%',
              background: 'var(--muted)',
              border:     'none',
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor:     'pointer',
              color:      'var(--muted-foreground)',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Form Body ─────────────────────────────────────────────── */}
        <div style={{
          padding:        '1.1rem 1.25rem 1.25rem',
          display:        'flex',
          flexDirection:  'column',
          gap:            '1rem',
        }}>

          {/* Descrizione */}
          <div>
            <label style={labelStyle}>Description *</label>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              value={form.description}
              onChange={e => handleInputChange('description', e.target.value)}
              placeholder="e.g. Rent, Gym, Insurance…"
              style={errors.description ? inputError : inputStyle}
            />
            {errors.description && <p style={errorStyle}>{errors.description}</p>}
          </div>

          {/* Categoria */}
          <div>
            <label style={labelStyle}>Category *</label>
            <select
              value={form.categoryId}
              onChange={e => handleInputChange('categoryId', e.target.value)}
              style={errors.categoryId ? selectError : selectStyle}
            >
              <option value="">Select a category</option>
              {expenseCategories.map(cat => (
                <option key={cat.id} value={cat.id?.toString() ?? ''}>
                  {(cat as any).icon ? `${(cat as any).icon} ` : ''}{cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p style={errorStyle}>{errors.categoryId}</p>}
          </div>

          {/* Importo + Data inizio (side by side like AddTransactionModal) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Importo */}
            <div>
              <label style={labelStyle}>Amount *</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position:  'absolute',
                  left:      '14px',
                  top:       '50%',
                  transform: 'translateY(-50%)',
                  color:     'var(--muted-foreground)',
                  fontSize:  '0.9rem',
                  fontWeight: 600,
                  pointerEvents: 'none',
                }}>€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={e => {
                    const raw = e.target.value;
                    if (/^[0-9]*[.,]?[0-9]*$/.test(raw) || raw === '')
                      handleInputChange('amount', raw);
                  }}
                  placeholder="0.00"
                  style={{
                    ...(errors.amount ? inputError : inputStyle),
                    paddingLeft: '2rem',
                  }}
                />
              </div>
              {errors.amount && <p style={errorStyle}>{errors.amount}</p>}
            </div>

            {/* Data inizio */}
            <div>
              <label style={labelStyle}>Start date *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => handleInputChange('startDate', e.target.value)}
                style={errors.startDate ? inputError : inputStyle}
              />
              {errors.startDate && <p style={errorStyle}>{errors.startDate}</p>}
            </div>
          </div>

          {/* Frequenza */}
          <div>
            <label style={labelStyle}>Frequency *</label>
            <select
              value={form.frequency}
              onChange={e => handleInputChange('frequency', e.target.value)}
              style={selectStyle}
            >
              <option value="monthly">Monthly</option>
              <option value="bimonthly">Every 2 months</option>
              <option value="quarterly">Quarterly (every 3 months)</option>
              <option value="semiannual">Every 6 months</option>
              <option value="annual">Yearly</option>
              <option value="custom">Custom (N days)</option>
            </select>
          </div>

          {/* Giorni custom */}
          {form.frequency === 'custom' && (
            <div>
              <label style={labelStyle}>Every how many days? *</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.customDays}
                onChange={e => {
                  if (/^\d*$/.test(e.target.value))
                    handleInputChange('customDays', e.target.value);
                }}
                placeholder="e.g. 14"
                style={errors.customDays ? inputError : inputStyle}
              />
              {errors.customDays && <p style={errorStyle}>{errors.customDays}</p>}
            </div>
          )}

          {/* Data fine (optional toggle) */}
          <div>
            <button
              type="button"
              onClick={() => setShowEndDate(v => !v)}
              style={{
                fontSize:   '0.82rem',
                fontWeight: 600,
                color:      'var(--muted-foreground)',
                background: 'none',
                border:     'none',
                padding:    '0',
                cursor:     'pointer',
                display:    'flex',
                alignItems: 'center',
                gap:        '0.35rem',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                width:          18,
                height:         18,
                borderRadius:   '50%',
                background:     showEndDate ? 'var(--foreground)' : 'var(--muted)',
                color:          showEndDate ? 'var(--background)' : 'var(--muted-foreground)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '10px',
                fontWeight:     700,
                flexShrink:     0,
                transition:     'all 0.15s',
              }}>
                {showEndDate ? '✓' : '+'}
              </span>
              End date
            </button>
            {showEndDate && (
              <input
                type="date"
                value={form.endDate}
                onChange={e => handleInputChange('endDate', e.target.value)}
                style={{ ...inputStyle, marginTop: '0.5rem' }}
              />
            )}
          </div>

          {/* Note */}
          <div>
            <label style={labelStyle}>
              Notes{' '}
              <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => handleInputChange('notes', e.target.value)}
              rows={2}
              placeholder="e.g. Apartment rent at 123 Main St"
              style={{
                ...inputStyle,
                height:     'auto',
                padding:    '0.75rem 1rem',
                resize:     'none',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Preview card */}
          {amount > 0 && (
            <div style={{
              background:    'var(--muted)',
              borderRadius:  '12px',
              padding:       '0.85rem 1rem',
              display:       'grid',
              gridTemplateColumns: '1fr 1fr',
              gap:           '0.75rem',
            }}>
              <div>
                <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Per month
                </p>
                <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
                  €{monthlyAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', margin: '0 0 3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Per year
                </p>
                <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-purple-600)', margin: 0, letterSpacing: '-0.02em' }}>
                  €{annualAmount.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Submit error */}
          {errors.submit && (
            <div style={{
              background:   'color-mix(in srgb, var(--destructive) 12%, var(--background))',
              padding:      '0.75rem',
              borderRadius: '10px',
              border:       '1px solid var(--destructive)',
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--destructive)', margin: 0, fontWeight: 600 }}>
                {errors.submit}
              </p>
            </div>
          )}

          {/* ── Actions (same layout as AddTransactionModal) ─────────── */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex:       1,
                height:     46,
                borderRadius: '12px',
                background: 'var(--muted)',
                color:      'var(--foreground)',
                border:     'none',
                fontSize:   '0.88rem',
                fontWeight: 600,
                cursor:     'pointer',
                fontFamily: 'var(--font-sans)',
                WebkitTapHighlightColor: 'transparent',
                opacity:    loading ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                flex:       2,
                height:     46,
                borderRadius: '12px',
                background: 'var(--foreground)',
                color:      'var(--background)',
                border:     'none',
                fontSize:   '0.88rem',
                fontWeight: 700,
                cursor:     'pointer',
                fontFamily: 'var(--font-sans)',
                WebkitTapHighlightColor: 'transparent',
                opacity:    loading ? 0.6 : 1,
              }}
            >
              {loading ? '...' : initialData ? 'Save changes' : 'Add recurring expense'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
