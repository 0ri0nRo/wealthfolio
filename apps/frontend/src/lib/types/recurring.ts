// src/lib/types/recurring.ts

export type RecurrenceFrequency =
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom';

export interface RecurringExpense {
  id: string | number;
  categoryId: number;
  amount: number;           // default amount (copied to new entries)
  description: string;
  frequency: RecurrenceFrequency;
  customDays?: number;
  startDate: string;        // ISO date YYYY-MM-DD
  endDate?: string | null;
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  category?: {
    id: number;
    name: string;
  };
}

/** One actual payment record per (recurringExpense, year, month). Editable. */
export interface RecurringExpenseEntry {
  id: string | number;
  recurringExpenseId: string | number;
  year: number;
  month: number;   // 1-12
  amount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A "virtual transaction" built from a RecurringExpenseEntry,
 * shaped like BudgetTransaction so it can be rendered in the same list.
 * The `id` is prefixed with "rec-" to avoid collision with real transaction IDs.
 */
export interface RecurringEntryAsTx {
  id: string;                    // "rec-{entry.id}"
  entryId: string | number;
  recurringExpenseId: string | number;
  categoryId: number;
  amount: number;
  type: 'expense';
  description: string;
  date: string;                  // first day of the month: YYYY-MM-01
  notes?: string;
  isRecurringEntry: true;        // discriminator flag
}

// ── Frequency helpers ──────────────────────────────────────────────────────────

export function frequencyToDays(
  frequency: RecurrenceFrequency,
  customDays?: number
): number {
  switch (frequency) {
    case 'monthly':    return 30;
    case 'bimonthly':  return 60;
    case 'quarterly':  return 91;
    case 'semiannual': return 182;
    case 'annual':     return 365;
    case 'custom':     return customDays ?? 30;
  }
}

export function calculateMonthlyAmount(
  amount: number,
  frequency: RecurrenceFrequency,
  customDays?: number
): number {
  switch (frequency) {
    case 'monthly':    return amount;
    case 'bimonthly':  return amount / 2;
    case 'quarterly':  return amount / 3;
    case 'semiannual': return amount / 6;
    case 'annual':     return amount / 12;
    case 'custom': {
      const days = customDays ?? 30;
      return days > 0 ? (amount / days) * 30 : 0;
    }
  }
}

export function calculateAnnualAmount(
  amount: number,
  frequency: RecurrenceFrequency,
  customDays?: number
): number {
  switch (frequency) {
    case 'monthly':    return amount * 12;
    case 'bimonthly':  return amount * 6;
    case 'quarterly':  return amount * 4;
    case 'semiannual': return amount * 2;
    case 'annual':     return amount;
    case 'custom': {
      const days = customDays ?? 30;
      return days > 0 ? (amount / days) * 365 : 0;
    }
  }
}

export function frequencyLabel(
  frequency: RecurrenceFrequency,
  customDays?: number
): string {
  switch (frequency) {
    case 'monthly':    return 'Monthly';
    case 'bimonthly':  return 'Every 2 months';
    case 'quarterly':  return 'Quarterly';
    case 'semiannual': return 'Every 6 months';
    case 'annual':     return 'Yearly';
    case 'custom':     return customDays ? `Every ${customDays} days` : 'Custom';
  }
}

/** Check if a recurring expense is active during a given month */
export function isRecurringActiveInMonth(
  e: RecurringExpense,
  year: number,
  month: number   // 1-12
): boolean {
  if (!e.isActive) return false;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0);   // last day of month
  const start = new Date(e.startDate);
  if (start > monthEnd) return false;
  if (e.endDate) {
    const end = new Date(e.endDate);
    if (end < monthStart) return false;
  }
  return true;
}

/** Build a virtual transaction from an entry + its parent recurring expense */
export function entryToVirtualTx(
  entry: RecurringExpenseEntry,
  recurring: RecurringExpense
): RecurringEntryAsTx {
  return {
    id:                  `rec-${entry.id}`,
    entryId:             entry.id,
    recurringExpenseId:  entry.recurringExpenseId,
    categoryId:          recurring.categoryId,
    amount:              entry.amount,
    type:                'expense',
    description:         recurring.description,
    date:                `${entry.year}-${String(entry.month).padStart(2, '0')}-01`,
    notes:               entry.notes,
    isRecurringEntry:    true,
  };
}
