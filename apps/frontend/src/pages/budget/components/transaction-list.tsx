// src/pages/Budget/components/TransactionList.tsx
import React, { useState } from 'react';
import { Edit2, Trash2, Search, Filter, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { BudgetTransaction } from '@/types/budget';

interface TransactionListProps {
  transactions: BudgetTransaction[];
  onEdit: (transaction: BudgetTransaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
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
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Transactions
        </h2>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Tutte
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'income'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <p>Nessuna transazione trovata</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    transaction.type === 'income'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {transaction.type === 'income' ? (
                      <ArrowUpCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {transaction.description}
                      </p>
                      {transaction.category && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${transaction.category.color}20`,
                            color: transaction.category.color,
                          }}
                        >
                          {transaction.category.icon} {transaction.category.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(transaction.date).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      {transaction.notes && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">
                          {transaction.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className={`text-base font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}€
                      {transaction.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
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
            </div>
          ))
        )}
      </div>

      {/* Pagination (optional) */}
      {filteredTransactions.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Visualizzate {filteredTransactions.length} transactions
          </p>
        </div>
      )}
    </div>
  );
};
