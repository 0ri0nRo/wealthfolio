// src/pages/Budget/components/BudgetChart.tsx
import { BudgetTransaction } from '@/lib/types/budget';
import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface BudgetChartProps {
  transactions: BudgetTransaction[];
  showLast12Months?: boolean;
}

export const BudgetChart: React.FC<BudgetChartProps> = ({ transactions = [], showLast12Months = false }) => {
  const [chartType, setChartType] = React.useState<'pie' | 'line'>('pie');

  const expensesByCategory = useMemo(() => {
    const categoryMap = new Map<string, { name: string; value: number; color: string }>();

    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const category = transaction.category;
        if (!category) return;

        const existing = categoryMap.get(String(category.id));
        if (existing) {
          existing.value += transaction.amount;
        } else {
          categoryMap.set(String(category.id), {
            name: category.name,
            value: transaction.amount,
            color: category.color,
          });
        }
      });

    return Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions]);

  const last12MonthsData = useMemo(() => {
    if (!showLast12Months) return [];

    const monthlyData = new Map<string, { month: string; income: number; expenses: number }>();
    const now = new Date();

    // Inizializza ultimi 12 mesi
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(monthKey, {
        month: date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
        income: 0,
        expenses: 0,
      });
    }

    // Aggiungi dati dalle transazioni
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
      }
    });

    return Array.from(monthlyData.values());
  }, [transactions, showLast12Months]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      if (showLast12Months) {
        return (
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="font-semibold text-gray-900 dark:text-white mb-2">
              {payload[0].payload.month}
            </p>
            <p className="text-sm text-green-600">
              Income: €{payload[0].value?.toFixed(2)}
            </p>
            <p className="text-sm text-red-600">
              Expenses: €{payload[1].value?.toFixed(2)}
            </p>
          </div>
        );
      } else {
        return (
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="font-semibold text-gray-900 dark:text-white">
              {payload[0].name}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              €{payload[0].value.toFixed(2)}
            </p>
          </div>
        );
      }
    }
    return null;
  };

  if (showLast12Months) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Income and Expenses - Last 12 Months
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={last12MonthsData}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="month"
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              className="text-xs text-gray-600 dark:text-gray-400"
              tickFormatter={(value) => `€${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorIncome)"
              name="Income"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorExpenses)"
              name="Expenses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Expenses by Category
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
            Pie Chart
          </button>
        </div>
      </div>

      {expensesByCategory.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No expenses recorded</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={expensesByCategory}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={100}
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
      )}
    </div>
  );
};
