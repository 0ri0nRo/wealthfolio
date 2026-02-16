// src/pages/Budget/index.tsx
import { useBudget } from '@/hooks/useBudget';
import { BudgetTransaction } from '@/lib/types/budget';
import { Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React, { useState } from 'react';
import { AddTransactionModal } from "./components/add-transaction-modal";
import { BudgetChart } from "./components/budget-chart";
import { MonthSelector } from "./components/month-selector";
import { TransactionList } from "./components/transaction-list";

export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);

  const {
    transactions,
    allTransactions,
    categories,
    summary,
    loading,
    error,
    createTransaction,
    deleteTransaction,
    updateTransaction,
    refresh,
  } = useBudget(selectedMonth);

  const actualBalance =
    (summary?.totalIncome ?? 0) - (summary?.totalExpenses ?? 0);

  const handleAddTransaction = async (
    transaction: Partial<BudgetTransaction>
  ) => {
    try {
      if (editingTransaction) {
        await updateTransaction(Number(editingTransaction.id), transaction);
      } else {
        await createTransaction({
          categoryId: transaction.categoryId!,
          amount: transaction.amount!,
          type: transaction.type!,
          description: transaction.description!,
          date: transaction.date!,
          notes: transaction.notes,
        });
      }

      setShowAddModal(false);
      setEditingTransaction(null);
    } catch (err) {
      console.error("Error saving transaction:", err);
      alert(
        "Error saving transaction: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  const handleDeleteTransaction = async (id: string | number) => {
    try {
      await deleteTransaction(id);
    } catch (err) {
      console.error("Error deleting transaction:", err);
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
          <p className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            Error loading budget data
          </p>
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

  const expensesWithoutInvestments = (transactions || [])
    .filter(
      (t) => t.type === "expense" && t.category?.name !== "Investments"
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const investments = (transactions || [])
    .filter((t) => t.type === "expense" && t.category?.name === "Investments")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/40 dark:border-gray-800/40 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
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

          <MonthSelector
            selectedMonth={selectedMonth}
            onChange={(date: Date) => setSelectedMonth(date)}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">

          {/* Income */}
          <div className="group bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Income
                </p>
                <p className="text-xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  €{(summary?.totalIncome ?? 0).toLocaleString("it-IT", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="group bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Expenses
                </p>
                <p className="text-xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  €{expensesWithoutInvestments.toLocaleString("it-IT", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-gradient-to-br from-red-400 to-rose-500 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
            </div>
          </div>

          {/* Saving */}
          <div className="group bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Saving
                </p>
                <p className="text-xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  €{investments.toLocaleString("it-IT", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-gradient-to-br from-purple-400 to-violet-500 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="group bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Balance
                </p>
                <p
                  className={`text-xl md:text-3xl font-semibold tracking-tight ${
                    actualBalance >= 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  €{actualBalance.toLocaleString("it-IT", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div
                className={`h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform bg-gradient-to-br ${
                  actualBalance >= 0
                    ? "from-blue-400 to-indigo-500"
                    : "from-red-400 to-rose-500"
                }`}
              >
                <Wallet className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="mb-8">
          <BudgetChart
            transactions={allTransactions || []}
            showLast12Months={true}
          />
        </div>

        <div className="mb-8">
          <BudgetChart transactions={transactions || []} />
        </div>

        {/* Transactions */}
        <TransactionList
          transactions={transactions || []}
          onEdit={(transaction: BudgetTransaction) => {
            setEditingTransaction(transaction);
            setShowAddModal(true);
          }}
          onDelete={(id) => handleDeleteTransaction(id)}
        />
      </div>

      {/* Modal */}
      {showAddModal && (
        <AddTransactionModal
          categories={categories || []}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(null);
          }}
          onSave={handleAddTransaction}
          initialData={editingTransaction || undefined}
        />
      )}
    </div>
  );
};
