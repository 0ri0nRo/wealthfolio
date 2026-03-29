import {
  BudgetCategory,
  BudgetFilters,
  BudgetSummary,
  BudgetTransaction,
  CreateBudgetTransactionInput,
} from '@/lib/types/budget';
import { RecurringExpense } from '@/lib/types/recurring';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '../adapters/shared/platform';

const YEARS_BACK = 2;

export const useBudget = (month: Date) => {
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<BudgetTransaction[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();

      const startDate = new Date(now.getFullYear() - YEARS_BACK, 0, 1);
      const totalMonths =
        (now.getFullYear() - startDate.getFullYear()) * 12 +
        (now.getMonth() - startDate.getMonth()) + 1;

      const [cats, txns, sum, allTxns, recurring] = await Promise.all([
        invoke<BudgetCategory[]>('get_budget_categories'),
        invoke<BudgetTransaction[]>('get_budget_transactions', {
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        }),
        invoke<BudgetSummary>('get_budget_summary', {
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        }),
        Promise.all(
          Array.from({ length: totalMonths }, (_, i) => {
            const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            return invoke<BudgetTransaction[]>('get_budget_transactions', {
              month: d.getMonth() + 1,
              year: d.getFullYear(),
            });
          })
        ).then(results => results.flat()),
        invoke<RecurringExpense[]>('get_recurring_expenses').catch(() => [] as RecurringExpense[]),
      ]);

      const categoriesMap = new Map(cats.map((c: BudgetCategory) => [String(c.id), c]));

      const normalizeTxn = (txn: any): BudgetTransaction => ({
        ...txn,
        type: txn.type ?? txn.transaction_type,
        categoryId: txn.categoryId ?? txn.category_id,
        category: categoriesMap.get(String(txn.categoryId ?? txn.category_id)) || undefined,
      });

      const enrichedTxns    = txns.map(normalizeTxn);
      const enrichedAllTxns = allTxns.map(normalizeTxn);

      const categoryBreakdown = Array.from(
        enrichedTxns
          .filter((t: BudgetTransaction) => t.type === 'expense')
          .reduce((acc: Map<string, any>, txn: BudgetTransaction) => {
            if (!txn.category) return acc;
            const key = String(txn.categoryId);
            const existing = acc.get(key);
            if (existing) {
              existing.total += txn.amount;
              existing.transactions += 1;
            } else {
              acc.set(key, {
                category: txn.category,
                total: txn.amount,
                transactions: 1,
                percentage: 0,
              });
            }
            return acc;
          }, new Map())
          .values()
      ) as Array<{
        category: BudgetCategory;
        total: number;
        transactions: number;
        percentage: number;
      }>;

      const totalExpenses = sum.totalExpenses || 0.01;
      categoryBreakdown.forEach((item: any) => {
        item.percentage = (item.total / totalExpenses) * 100;
      });

      setCategories(cats);
      setTransactions(enrichedTxns);
      setAllTransactions(enrichedAllTxns);
      setSummary({ ...sum, categoryBreakdown });
      setRecurringExpenses(recurring);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
      console.error('Error fetching budget data:', err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createTransaction = async (data: CreateBudgetTransactionInput) => {
    try {
      await invoke('create_budget_transaction', {
        categoryId:      data.categoryId,
        amount:          data.amount,
        transactionType: data.type,
        description:     data.description,
        date:            data.date,
        notes:           data.notes || null,
      });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error creating transaction');
    }
  };

  const updateTransaction = async (id: number, data: Partial<BudgetTransaction>) => {
    try {
      await invoke('update_budget_transaction', {
        id,
        categoryId:      data.categoryId,
        amount:          data.amount,
        transactionType: data.type,
        description:     data.description,
        date:            data.date,
        notes:           data.notes,
      });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error updating transaction');
    }
  };

  const deleteTransaction = async (id: string | number) => {
    try {
      await invoke('delete_budget_transaction', { id });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error deleting transaction');
    }
  };

  const createCategory = async (data: {
    name: string;
    type: 'income' | 'expense';
    color: string;
    icon?: string;
    parentId?: number;
  }) => {
    try {
      await invoke('create_budget_category', {
        name:     data.name,
        type:     data.type,
        color:    data.color,
        icon:     data.icon || null,
        parentId: data.parentId || null,
      });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error creating category');
    }
  };

  const updateCategory = async (
    id: number,
    data: {
      name?: string;
      type?: 'income' | 'expense';
      color?: string;
      icon?: string;
      parentId?: number;
      isActive?: boolean;
    }
  ) => {
    try {
      await invoke('update_budget_category', {
        id,
        name:         data.name,
        categoryType: data.type ?? null,
        color:        data.color,
        icon:         data.icon,
        parentId:     data.parentId,
        isActive:     data.isActive,
      });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error updating category');
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      await invoke('delete_budget_category', { id });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error deleting category');
    }
  };

  // ── Recurring expenses CRUD ───────────────────────────────────────────────

  const createRecurringExpense = async (data: Partial<RecurringExpense>) => {
    try {
      await invoke('create_recurring_expense', {
        category_id: data.categoryId,
        amount: data.amount,
        description: data.description,
        frequency: data.frequency,
        custom_days: data.customDays ?? null,
        start_date: data.startDate,
        end_date: data.endDate ?? null,
        notes: data.notes ?? null,
      });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error creating recurring expense');
    }
  };

  const updateRecurringExpense = async (id: number, data: Partial<RecurringExpense>) => {
    try {
      await invoke('update_recurring_expense', {
        id,
        category_id: data.categoryId,
        amount: data.amount,
        description: data.description,
        frequency: data.frequency,
        custom_days: data.customDays ?? null,
        start_date: data.startDate,
        end_date: data.endDate ?? null,
        notes: data.notes ?? null,
        is_active: data.isActive,
      });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error updating recurring expense');
    }
  };

  const deleteRecurringExpense = async (id: string | number) => {
    try {
      await invoke('delete_recurring_expense', { id });
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Error deleting recurring expense');
    }
  };

  return {
    transactions,
    allTransactions,
    categories,
    summary,
    loading,
    error,
    refresh: fetchData,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    createCategory,
    updateCategory,
    deleteCategory,
    recurringExpenses,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
  };
};

export const useFilteredTransactions = (
  transactions: BudgetTransaction[],
  filters: BudgetFilters
) => {
  return transactions.filter(transaction => {
    if (filters.startDate && transaction.date < filters.startDate) return false;
    if (filters.endDate   && transaction.date > filters.endDate)   return false;
    if (filters.type      && transaction.type !== filters.type)    return false;
    return true;
  });
};
