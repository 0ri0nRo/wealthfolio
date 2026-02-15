// src/pages/Budget/BudgetPage.tsx
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/lib/types/budget';
import { Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React, { useState } from 'react';
import { AddTransactionModal } from "./components/add-transaction-modal";
import { BudgetChart } from "./components/budget-chart";
import { CategoryBreakdown } from "./components/category-breakdown";
import { MonthSelector } from "./components/month-selector";
import { TransactionList } from "./components/transaction-list";

export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null); // ✅ AGGIUNGI
  const {
    transactions,
    allTransactions,
    categories,
    summary,
    loading,
    error,
    createTransaction,
    deleteTransaction,
    updateTransaction,  // ✅ AGGIUNGI
    refresh,
  } = useBudget(selectedMonth);

const handleAddTransaction = async (transaction: Partial<BudgetTransaction>) => {
  try {
    if (editingTransaction) {
      // UPDATE
      console.log('Updating transaction:', editingTransaction.id, transaction); // ✅ AGGIUNGI LOG
      await updateTransaction(Number(editingTransaction.id), transaction);
      console.log('Update completed'); // ✅ AGGIUNGI LOG
    } else {
      // CREATE
      await createTransaction({
        categoryId: transaction.categoryId!,
        amount: transaction.amount!,
        type: transaction.type!,
        description: transaction.description!,
        date: transaction.date!,
        notes: transaction.notes,
      });
    }
    console.log('Closing modal'); // ✅ AGGIUNGI LOG
    setShowAddModal(false);
    setEditingTransaction(null);
    console.log('Modal closed'); // ✅ AGGIUNGI LOG
  } catch (err) {
    console.error('Error saving transaction:', err);
    // ✅ AGGIUNGI: mostra l'errore all'utente
    alert('Error saving transaction: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
};
    const handleDeleteTransaction = async (id: string | number) => {
    try {
      await deleteTransaction(id);
    } catch (err) {
      console.error('Error deleting transaction:', err);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">Error loading budget data</p>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={refresh}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-sm shadow-blue-500/20"
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
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-800/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Budget
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Track your income and expenses
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Transaction
            </button>
          </div>

          {/* Month Selector */}
          <MonthSelector
            selectedMonth={selectedMonth}
            onChange={(date: Date) => setSelectedMonth(date)}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Income
                </p>
                <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                  €{(summary?.totalIncome ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Expenses
                </p>
                <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                  €{(summary?.totalExpenses ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-500" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Balance
                </p>
                <p className={`text-3xl font-semibold ${
                  (summary?.balance ?? 0) >= 0
                    ? 'text-blue-600 dark:text-blue-500'
                    : 'text-red-600 dark:text-red-500'
                }`}>
                  €{(summary?.balance ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Breakdown */}
        {/* Grafico ultimi 12 mesi */}
        <div className="mb-8">
          <BudgetChart transactions={allTransactions || []} showLast12Months={true} />
        </div>

        {/* Charts and Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BudgetChart transactions={transactions || []} />
          <CategoryBreakdown summary={summary} />
        </div>

        {/* Transactions List */}
          <TransactionList
          transactions={transactions || []}
          onEdit={(transaction: BudgetTransaction) => {
            setEditingTransaction(transaction);  // ✅ CAMBIA
            setShowAddModal(true);                // ✅ CAMBIA
          }}
          onDelete={(id) => handleDeleteTransaction(id)}
        />
      </div>

      {/* Add Transaction Modal */}
        {showAddModal && (
        <AddTransactionModal
          categories={categories || []}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(null);  // ✅ AGGIUNGI
          }}
          onSave={handleAddTransaction}
          initialData={editingTransaction || undefined}  // ✅ AGGIUNGI
        />
      )}
    </div>
  );
};
