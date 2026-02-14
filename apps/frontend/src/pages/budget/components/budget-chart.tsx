// src/pages/Budget/components/BudgetChart.tsx
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BudgetTransaction } from '@/types/budget';

interface BudgetChartProps {
  transactions: BudgetTransaction[];
}

export const BudgetChart: React.FC<BudgetChartProps> = ({ transactions }) => {
  const [chartType, setChartType] = React.useState<'pie' | 'bar'>('pie');

  const expensesByCategory = useMemo(() => {
    const categoryMap = new Map<string, { name: string; value: number; color: string }>();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const category = transaction.category;
        if (!category) return;
        
        const existing = categoryMap.get(category.id);
        if (existing) {
          existing.value += transaction.amount;
        } else {
          categoryMap.set(category.id, {
            name: category.name,
            value: transaction.amount,
            color: category.color,
          });
        }
      });
    
    return Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [transactions]);

  const incomeVsExpenses = useMemo(() => {
    const monthlyData = new Map<string, { month: string; income: number; expenses: number }>();
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const existing = monthlyData.get(monthKey);
      if (existing) {
        if (transaction.type === 'income') {
          existing.income += transaction.amount;
        } else {
          existing.expenses += transaction.amount;
        }
      } else {
        monthlyData.set(monthKey, {
          month: date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }),
          income: transaction.type === 'income' ? transaction.amount : 0,
          expenses: transaction.type === 'expense' ? transaction.amount : 0,
        });
      }
    });
    
    return Array.from(monthlyData.values()).slice(-6); // Last 6 months
  }, [transactions]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">
            {payload[0].name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            €{payload[0].value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Spese per Categoria
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1 text-sm rounded-md ${
              chartType === 'pie'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Torta
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 text-sm rounded-md ${
              chartType === 'bar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Barre
          </button>
        </div>
      </div>

      {expensesByCategory.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>Nessuna spesa registrata</p>
        </div>
      ) : chartType === 'pie' ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={expensesByCategory}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {expensesByCategory.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={incomeVsExpenses}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis 
              dataKey="month" 
              className="text-xs text-gray-600 dark:text-gray-400"
            />
            <YAxis 
              className="text-xs text-gray-600 dark:text-gray-400"
              tickFormatter={(value) => `€${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                      <p className="font-semibold text-gray-900 dark:text-white mb-2">
                        {payload[0].payload.month}
                      </p>
                      <p className="text-sm text-green-600">
                        Income: €{payload[0].value?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-red-600">
                        Expenses: €{payload[1].value?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="income" fill="#10b981" name="Income" radius={[8, 8, 0, 0]} />
            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
