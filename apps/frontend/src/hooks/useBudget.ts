import {
  BudgetCategory,
  BudgetFilters,
  BudgetSummary,
  BudgetTransaction,
  CreateBudgetTransactionInput,
} from '@/lib/types/budget';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useState } from 'react';

export const useBudget = (month: Date) => {
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [cats, txns, sum] = await Promise.all([
        invoke<BudgetCategory[]>('get_budget_categories'),
        invoke<BudgetTransaction[]>('get_budget_transactions', {
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        }),
        invoke<BudgetSummary>('get_budget_summary', {
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        }),
      ]);

      setCategories(cats);
      setTransactions(txns);
      setSummary(sum);
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
        categoryId: data.categoryId,  // Già number, non serve parseInt
        amount: data.amount,
        transactionType: data.type,
        description: data.description,
        date: data.date,
        notes: data.notes || null,
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
        categoryId: data.categoryId,
        amount: data.amount,
        transactionType: data.type,
        description: data.description,
        date: data.date,
        notes: data.notes,
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

  return {
    transactions,
    categories,
    summary,
    loading,
    error,
    refresh: fetchData,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
};

export const useFilteredTransactions = (
  transactions: BudgetTransaction[],
  filters: BudgetFilters
) => {
  return transactions.filter(transaction => {
    if (filters.startDate && transaction.date < filters.startDate) return false;
    if (filters.endDate && transaction.date > filters.endDate) return false;
    if (filters.type && transaction.type !== filters.type) return false;
    return true;
  });
};
