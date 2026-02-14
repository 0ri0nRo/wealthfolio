import React from 'react';
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
          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        
        {!isCurrentMonth() && (
          <button
            onClick={goToCurrentMonth}
            className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Today
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
