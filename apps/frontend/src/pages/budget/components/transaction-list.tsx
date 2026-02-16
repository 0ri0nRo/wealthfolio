// src/pages/Budget/components/TransactionList.tsx
import { BudgetTransaction } from '@/lib/types/budget';
import { ArrowDownCircle, ArrowUpCircle, Edit2, Search, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

interface TransactionListProps {
  transactions: BudgetTransaction[];
  onEdit: (transaction: BudgetTransaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions = [],
  onEdit,
  onDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const filteredTransactions = transactions
    .filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.category?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        return b.amount - a.amount;
      }
    });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Transactions
        </h2>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Tutte
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filterType === 'income'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filterType === 'expense'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Expenses
            </button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
            className="px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="date">Data</option>
            <option value="amount">Importo</option>
          </select>
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm">Nessuna transazione trovata</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start sm:items-center gap-3">
                {/* Icon */}
                <div className={`h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 rounded-full flex items-center justify-center ${
                  transaction.type === 'income'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {transaction.type === 'income' ? (
                    <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  {/* Nome transazione */}
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">
                    {transaction.description}
                  </p>

                  {/* Categoria e Data - su una riga separata */}
                  <div className="flex flex-wrap items-center gap-2">
                    {transaction.category && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                        style={{
                          backgroundColor: `${transaction.category.color}20`,
                          color: transaction.category.color,
                        }}
                      >
                        <span className="mr-1">{transaction.category.icon}</span>
                        <span className="truncate max-w-[120px]">{transaction.category.name}</span>
                      </span>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {new Date(transaction.date).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Note (se presenti) */}
                  {transaction.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                      {transaction.notes}
                    </p>
                  )}
                </div>

                {/* Amount - sempre visibile */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm sm:text-base font-semibold whitespace-nowrap ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}€{transaction.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Actions - nascosti su mobile molto piccolo */}
                <div className="hidden sm:flex items-center gap-2 ml-2">
                  <button
                    onClick={() => onEdit(transaction)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Modifica"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Sei sicuro di voler eliminare questa transazione?')) {
                        onDelete(transaction.id);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Actions mobile - mostrati sotto */}
              <div className="flex sm:hidden items-center gap-2 mt-2 ml-12">
                <button
                  onClick={() => onEdit(transaction)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <Edit2 className="h-3 w-3 inline mr-1" />
                  Modifica
                </button>
                <button
                  onClick={() => {
                    if (confirm('Sei sicuro di voler eliminare questa transazione?')) {
                      onDelete(transaction.id);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="h-3 w-3 inline mr-1" />
                  Elimina
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination (optional) */}
      {filteredTransactions.length > 0 && (
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
            Visualizzate {filteredTransactions.length} transactions
          </p>
        </div>
      )}
    </div>
  );
};
