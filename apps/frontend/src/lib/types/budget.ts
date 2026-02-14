// src/types/budget.ts

export type TransactionType = 'income' | 'expense';

export type RecurringPattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface BudgetCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTransaction {
  id: string;
  accountId?: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  notes?: string;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  // Joined data
  category?: BudgetCategory;
}

export interface BudgetLimit {
  id: string;
  categoryId: string;
  month: number;
  year: number;
  limitAmount: number;
  spent?: number;
  remaining?: number;
  percentage?: number;
  createdAt: string;
  updatedAt: string;
  category?: BudgetCategory;
}

export interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  period: {
    start: string;
    end: string;
  };
  categoryBreakdown: {
    category: BudgetCategory;
    total: number;
    transactions: number;
    percentage: number;
  }[];
}

export interface MonthlyBudgetOverview {
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  budgetLimits: BudgetLimit[];
  topCategories: {
    income: { category: BudgetCategory; amount: number }[];
    expense: { category: BudgetCategory; amount: number }[];
  };
}

export interface CreateBudgetTransactionInput {
  accountId?: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  notes?: string;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  tags?: string[];
}

export interface UpdateBudgetTransactionInput extends Partial<CreateBudgetTransactionInput> {
  id: string;
}

export interface CreateBudgetCategoryInput {
  name: string;
  type: TransactionType;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface BudgetFilters {
  startDate?: string;
  endDate?: string;
  categoryIds?: string[];
  type?: TransactionType;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
}
