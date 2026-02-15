import {
  BudgetCategory,
  BudgetFilters,
  BudgetSummary,
  BudgetTransaction,
  CreateBudgetTransactionInput,
} from '@/lib/types/budget';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '../adapters/shared/platform';

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

    // ✅ AGGIUNGI QUESTO: JOIN client-side delle categorie
    const categoriesMap = new Map(cats.map(c => [
      String(c.id), // o Number(c.id) se preferisci
      c
    ]));

    // Aggiungi l'oggetto category completo a ogni transazione
    const enrichedTxns = txns.map(txn => ({
      ...txn,
      category: categoriesMap.get(String(txn.categoryId)) || undefined,
    }));

    // ✅ AGGIUNGI QUESTO: Calcola categoryBreakdown per il summary
    const categoryBreakdown = Array.from(
      enrichedTxns
        .filter(t => t.type === 'expense')
        .reduce((acc, txn) => {
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
              percentage: 0, // calcoliamo dopo
            });
          }
          return acc;
        }, new Map())
        .values()
    );

    // Calcola le percentuali
    const totalExpenses = sum.totalExpenses || 0.01; // evita divisione per zero
    categoryBreakdown.forEach(item => {
      item.percentage = (item.total / totalExpenses) * 100;
    });

    setCategories(cats);
    setTransactions(enrichedTxns);
    setSummary({
      ...sum,
      categoryBreakdown,
    });
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
