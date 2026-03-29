// lib/types/recurring.ts

export type RecurrenceFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

export interface RecurringExpense {
  id: string | number;
  categoryId: number;
  category?: {
    id: number;
    name: string;
  };
  amount: number;
  description: string;
  frequency: RecurrenceFrequency;
  customDays?: number; // Per 'custom': numero di giorni tra le ricorrenze
  startDate: string | Date;
  endDate?: string | Date | null; // null = nessuna data di fine
  isActive: boolean;
  notes?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface RecurringExpenseWithStats extends RecurringExpense {
  monthlyAmount: number; // €/mese calcolato
  annualAmount: number;  // €/anno calcolato
  nextOccurrence?: string | Date;
}

// Utility: calcola frequenza in giorni
export const frequencyToDays = (freq: RecurrenceFrequency, customDays?: number): number => {
  const map: Record<RecurrenceFrequency, number> = {
    monthly: 30,
    bimonthly: 60,
    quarterly: 90,
    semiannual: 180,
    annual: 365,
    custom: customDays || 30,
  };
  return map[freq];
};

// Utility: calcola importo mensile equivalente
export const calculateMonthlyAmount = (amount: number, frequency: RecurrenceFrequency, customDays?: number): number => {
  const days = frequencyToDays(frequency, customDays);
  return (amount * 365) / days / 12;
};

// Utility: calcola importo annuale equivalente
export const calculateAnnualAmount = (amount: number, frequency: RecurrenceFrequency, customDays?: number): number => {
  const days = frequencyToDays(frequency, customDays);
  return (amount * 365) / days;
};

// Utility: label leggibile per frequenza
export const frequencyLabel = (freq: RecurrenceFrequency, customDays?: number): string => {
  const labels: Record<RecurrenceFrequency, string> = {
    monthly: 'Mensile',
    bimonthly: 'Bimestrale',
    quarterly: 'Trimestrale',
    semiannual: 'Semestrale',
    annual: 'Annuale',
    custom: `Ogni ${customDays} giorni`,
  };
  return labels[freq];
};
