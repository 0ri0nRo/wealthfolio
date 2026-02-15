import { BudgetSummary } from '@/lib/types/budget';
import React from 'react';

interface CategoryBreakdownProps {
  summary: BudgetSummary | null;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ summary }) => {
if (!summary || !summary.categoryBreakdown || summary.categoryBreakdown.length === 0) {
      return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Category Breakdown
        </h2>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Category Breakdown
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
                    {item.transactions} transactions
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  item.category.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
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
          Show all categories ({summary.categoryBreakdown.length})
        </button>
      )}
    </div>
  );
};
