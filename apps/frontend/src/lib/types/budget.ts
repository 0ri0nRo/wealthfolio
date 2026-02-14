// src/types/budget.ts

export type TransactionType = 'income' | 'expense';

export type RecurringPattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Match esatto con il backend Rust
export interface BudgetCategory {
  id: number;  // i64 in Rust
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
  parentId?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTransaction {
  id?: number;
  categoryId: number;
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  notes?: string;
}

export interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface CreateBudgetTransactionInput {
  categoryId: number;  // Già number, non string!
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  notes?: string;
}

export interface BudgetFilters {
  startDate?: string;
  endDate?: string;
  categoryIds?: number[];
  type?: TransactionType;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}
