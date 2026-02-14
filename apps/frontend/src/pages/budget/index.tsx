// src/pages/Budget/BudgetPage.tsx
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/types/budget';
import { Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React, { useState } from 'react';
import { AddTransactionModal } from "./components/add-transaction-modal";
import { BudgetChart } from "./components/budget-chart";
import { CategoryBreakdown } from "./components/category-breakdown";
import { MonthSelector } from "./components/month-selector";
import { TransactionList } from "./components/transaction-list";

export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);

  // USA IL HOOK INVECE DELLO STATO LOCALE
  const {
    transactions,
    categories,
    summary,
    loading,
    error,
    createTransaction,
    deleteTransaction,
    refresh,
  } = useBudget(selectedMonth);

  const handleAddTransaction = async (transaction: Partial<BudgetTransaction>) => {
    try {
      await createTransaction({
        categoryId: transaction.categoryId!,
        amount: transaction.amount!,
        type: transaction.type!,
        description: transaction.description!,
        date: transaction.date!,
        notes: transaction.notes,
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
      // Mostra un toast/alert all'utente
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    try {
      await deleteTransaction(id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      // Mostra un toast/alert all'utente
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold mb-4">Error loading budget data</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Budget
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage your income and expenses
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Transaction
            </button>
          </div>

          {/* Month Selector */}
          <div className="mt-6">
            <MonthSelector
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Income
                </p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  €{(summary?.totalIncome ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Expenses
                </p>
                <p className="text-2xl font-bold text-red-600 mt-2">
                  €{(summary?.totalExpenses ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Balance
                </p>
                <p className={`text-2xl font-bold mt-2 ${
                  (summary?.balance ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  €{(summary?.balance ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Wallet className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BudgetChart transactions={transactions} />
          <CategoryBreakdown summary={summary} />
        </div>

        {/* Transactions List */}
        <TransactionList
          transactions={transactions}
          onEdit={(transaction) => {
            // TODO: Implementa la modifica
            console.log('Edit transaction:', transaction);
          }}
          onDelete={handleDeleteTransaction}
        />
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <AddTransactionModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddTransaction}
        />
      )}
    </div>
  );
};
