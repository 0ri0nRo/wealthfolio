// src/pages/Budget/BudgetPage.tsx
import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { BudgetSummary, BudgetTransaction, BudgetCategory, MonthlyBudgetOverview } from '@/types/budget';
import { BudgetOverview } from './components/BudgetOverview';
import { TransactionList } from './components/TransactionList';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { AddTransactionModal } from './components/AddTransactionModal';
import { BudgetChart } from './components/BudgetChart';
import { MonthSelector } from './components/MonthSelector';

export const BudgetPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [monthlyOverview, setMonthlyOverview] = useState<MonthlyBudgetOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBudgetData();
  }, [selectedMonth]);

  const loadBudgetData = async () => {
    setLoading(true);
    try {
      // Qui chiamerai le tue API Tauri
      // const data = await invoke('get_budget_summary', { 
      //   month: selectedMonth.getMonth() + 1,
      //   year: selectedMonth.getFullYear()
      // });
      
      // Mock data per esempio
      const mockSummary: BudgetSummary = {
        totalIncome: 3500,
        totalExpenses: 2300,
        balance: 1200,
        period: {
          start: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).toISOString(),
          end: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).toISOString(),
        },
        categoryBreakdown: [],
      };
      
      setSummary(mockSummary);
    } catch (error) {
      console.error('Error loading budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (transaction: Partial<BudgetTransaction>) => {
    try {
      // await invoke('create_budget_transaction', { transaction });
      await loadBudgetData();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                Gestisci le tue entrate e uscite
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuova Transazione
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
                  Entrate
                </p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  €{summary?.totalIncome.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
                  Uscite
                </p>
                <p className="text-2xl font-bold text-red-600 mt-2">
                  €{summary?.totalExpenses.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
                  Bilancio
                </p>
                <p className={`text-2xl font-bold mt-2 ${
                  (summary?.balance ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  €{summary?.balance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
            // Handle edit
          }}
          onDelete={async (id) => {
            // Handle delete
            await loadBudgetData();
          }}
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
