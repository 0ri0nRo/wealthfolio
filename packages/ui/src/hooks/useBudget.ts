// src/hooks/useBudget.ts
import {
  BudgetCategory,
  BudgetFilters,
  BudgetSummary,
  BudgetTransaction,
  CreateBudgetTransactionInput,
} from '@/lib/types/budget';
import { useCallback, useEffect, useState } from 'react';

// Questo è un esempio - dovrai adattarlo alle tue API Tauri
// import { invoke } from '@tauri-apps/api/tauri';

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
      // Esempio di chiamate API - sostituisci con le tue chiamate Tauri
      // const [txns, cats, sum] = await Promise.all([
      //   invoke('get_budget_transactions', {
      //     month: month.getMonth() + 1,
      //     year: month.getFullYear(),
      //   }),
      //   invoke('get_budget_categories'),
      //   invoke('get_budget_summary', {
      //     month: month.getMonth() + 1,
      //     year: month.getFullYear(),
      //   }),
      // ]);

      // Mock data per sviluppo
      const mockCategories: BudgetCategory[] = [
        {
          id: '1',
          name: 'Alimentari',
          type: 'expense',
          color: '#ef4444',
          icon: '🛒',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Stipendio',
          type: 'income',
          color: '#10b981',
          icon: '💼',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const mockTransactions: BudgetTransaction[] = [
        {
          id: '1',
          categoryId: '1',
          amount: 50.25,
          type: 'expense',
          description: 'Spesa settimanale',
          date: new Date().toISOString().split('T')[0],
          isRecurring: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: mockCategories[0],
        },
      ];

      const mockSummary: BudgetSummary = {
        totalIncome: 3500,
        totalExpenses: 2300,
        balance: 1200,
        period: {
          start: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
          end: new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString(),
        },
        categoryBreakdown: [
          {
            category: mockCategories[0],
            total: 450,
            transactions: 12,
            percentage: 19.6,
          },
        ],
      };

      setCategories(mockCategories);
      setTransactions(mockTransactions);
      setSummary(mockSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento dei dati');
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
      // await invoke('create_budget_transaction', { data });
      console.log('Creating transaction:', data);
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Errore durante la creazione');
    }
  };

  const updateTransaction = async (id: string, data: Partial<BudgetTransaction>) => {
    try {
      // await invoke('update_budget_transaction', { id, data });
      console.log('Updating transaction:', id, data);
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Errore durante l\'aggiornamento');
    }
  };

    const deleteTransaction = async (id: string | number) => {
    try {
      // await invoke('delete_budget_transaction', { id });
      console.log('Deleting transaction:', id);
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Errore durante l\'eliminazione');
    }
  };

  const createCategory = async (data: Partial<BudgetCategory>) => {
    try {
      // await invoke('create_budget_category', { data });
      console.log('Creating category:', data);
      await fetchData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Errore durante la creazione categoria');
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
    createCategory,
  };
};

// Hook per filtrare le transazioni
export const useFilteredTransactions = (
  transactions: BudgetTransaction[],
  filters: BudgetFilters
) => {
  return transactions.filter(transaction => {
    // Filter by date range
    if (filters.startDate && transaction.date < filters.startDate) return false;
    if (filters.endDate && transaction.date > filters.endDate) return false;

    // Filter by category
    if (filters.categoryIds?.length && !filters.categoryIds.includes(transaction.categoryId)) {
      return false;
    }

    // Filter by type
    if (filters.type && transaction.type !== filters.type) return false;

    // Filter by search query
    if (filters.search) {
      const query = filters.search.toLowerCase();
      const matchesDescription = transaction.description.toLowerCase().includes(query);
      const matchesCategory = transaction.category?.name.toLowerCase().includes(query);
      if (!matchesDescription && !matchesCategory) return false;
    }

    // Filter by amount
    if (filters.minAmount !== undefined && transaction.amount < filters.minAmount) return false;
    if (filters.maxAmount !== undefined && transaction.amount > filters.maxAmount) return false;

    // Filter by tags
    if (filters.tags?.length) {
      const hasMatchingTag = filters.tags.some(tag =>
        transaction.tags?.includes(tag)
      );
      if (!hasMatchingTag) return false;
    }

    return true;
  });
};
