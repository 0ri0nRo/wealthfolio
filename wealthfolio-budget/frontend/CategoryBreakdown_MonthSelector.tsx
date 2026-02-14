// src/pages/Budget/components/CategoryBreakdown.tsx
import React from 'react';
import { BudgetSummary } from '@/types/budget';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface CategoryBreakdownProps {
  summary: BudgetSummary | null;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ summary }) => {
  if (!summary || summary.categoryBreakdown.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Ripartizione per Categoria
        </h2>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  const total = summary.totalExpenses + summary.totalIncome;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Ripartizione per Categoria
      </h2>
      
      <div className="space-y-4">
        {summary.categoryBreakdown.slice(0, 6).map((item, index) => (
          <div key={index}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xl">{item.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.category.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.transactions} transazioni
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  item.category.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  €{item.total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.category.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      
      {summary.categoryBreakdown.length > 6 && (
        <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
          Mostra tutte le categorie ({summary.categoryBreakdown.length})
        </button>
      )}
    </div>
  );
};

// src/pages/Budget/components/MonthSelector.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  selectedMonth: Date;
  onChange: (date: Date) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({ selectedMonth, onChange }) => {
  const goToPreviousMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onChange(newDate);
  };

  const goToCurrentMonth = () => {
    onChange(new Date());
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return (
      selectedMonth.getMonth() === now.getMonth() &&
      selectedMonth.getFullYear() === now.getFullYear()
    );
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={goToPreviousMonth}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </button>
      
      <div className="flex items-center gap-3">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {selectedMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </h3>
        
        {!isCurrentMonth() && (
          <button
            onClick={goToCurrentMonth}
            className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Oggi
          </button>
        )}
      </div>
      
      <button
        onClick={goToNextMonth}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
};
