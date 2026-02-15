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
  const [allTransactions, setAllTransactions] = useState<BudgetTransaction[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Calcola gli ultimi 12 mesi
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const [cats, txns, sum, allTxns] = await Promise.all([
        invoke<BudgetCategory[]>('get_budget_categories'),
        invoke<BudgetTransaction[]>('get_budget_transactions', {
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        }),
        invoke<BudgetSummary>('get_budget_summary', {
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        }),
        // Carica tutte le transazioni degli ultimi 12 mesi
        Promise.all(
          Array.from({ length: 12 }, (_, i) => {
            const d = new Date(startDate);
            d.setMonth(startDate.getMonth() + i);
            return invoke<BudgetTransaction[]>('get_budget_transactions', {
              month: d.getMonth() + 1,
              year: d.getFullYear(),
            });
          })
        ).then(results => results.flat()),
      ]);

      // JOIN client-side delle categorie
      const categoriesMap = new Map(cats.map((c: BudgetCategory) => [String(c.id), c]));

      // Aggiungi l'oggetto category completo a ogni transazione
      const enrichedTxns = txns.map((txn: any) => ({
        ...txn,
        category: categoriesMap.get(String(txn.categoryId)) || undefined,
      }));

      const enrichedAllTxns = allTxns.map((txn: any) => ({
        ...txn,
        category: categoriesMap.get(String(txn.categoryId)) || undefined,
      }));

      // Calcola categoryBreakdown per il summary
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

      // Calcola le percentuali
      const totalExpenses = sum.totalExpenses || 0.01;
      categoryBreakdown.forEach((item: any) => {
        item.percentage = (item.total / totalExpenses) * 100;
      });

      setCategories(cats);
      setTransactions(enrichedTxns);
      setAllTransactions(enrichedAllTxns);
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
        categoryId: data.categoryId,
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
    allTransactions,
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
