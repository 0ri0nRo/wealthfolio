import { BudgetTransaction } from '@/lib/types/budget';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BudgetChartProps {
  transactions: BudgetTransaction[];
  showLast12Months?: boolean;
}

/**
 * IMPORTANTE:
 * Qui definiamo come riconoscere un investimento.
 * Se le tue categorie investimento hanno un campo specifico (es. category.type === 'investment')
 * puoi sostituire la logica sotto.
 */
const isInvestment = (transaction: BudgetTransaction) => {
  if (!transaction.category) return false;

  const name = transaction.category.name.toLowerCase();

  return (
    name.includes('invest') ||
    name.includes('crypto') ||
    name.includes('etf') ||
    name.includes('stock')
  );
};

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ef4444',
  '#f97316',
];

export const BudgetChart: React.FC<BudgetChartProps> = ({
  transactions = [],
  showLast12Months = false,
}) => {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  /**
   * ================================
   *  DONUT DATA (NO INVESTMENTS)
   * ================================
   */
  const expensesByCategory = useMemo(() => {
    type CategoryData = { name: string; value: number; color: string; icon: string };
    const categoryMap = new Map<string, CategoryData>();

    transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          !isInvestment(t) // 🚀 ESCLUDIAMO INVESTIMENTI
      )
      .forEach((transaction) => {
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
            icon: category.icon || '📦',
          });
        }
      });

    return Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((item, index) => ({
        ...item,
        color: COLORS[index % COLORS.length],
      }));
  }, [transactions]);

  /**
   * ================================
   *  LAST 12 MONTHS (NO INVESTMENTS)
   * ================================
   */
  const last12MonthsData = useMemo(() => {
    if (!showLast12Months) return [];

    type MonthlyData = { month: string; income: number; expenses: number };
    const monthlyData = new Map<string, MonthlyData>();

    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      monthlyData.set(key, {
        month: date.toLocaleDateString('it-IT', { month: 'short' }),
        income: 0,
        expenses: 0,
      });
    }

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      const existing = monthlyData.get(key);
      if (!existing) return;

      if (transaction.type === 'income') {
        existing.income += transaction.amount;
      }

      if (
        transaction.type === 'expense' &&
        !isInvestment(transaction) // 🚀 ESCLUDIAMO INVESTIMENTI
      ) {
        existing.expenses += transaction.amount;
      }
    });

    return Array.from(monthlyData.values());
  }, [transactions, showLast12Months]);

  /**
   * ================================
   *  12 MONTHS VIEW
   * ================================
   */
  if (showLast12Months) {
    // 📱 Font size responsivo per mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const axisFontSize = isMobile ? 10 : 12;
    const tickFontSize = isMobile ? 9 : 11;

    return (
      <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white">
          Andamento ultimi 12 mesi
        </h3>

        <ResponsiveContainer width="100%" height={isMobile ? 240 : 260}>
          <AreaChart data={last12MonthsData}>
            <defs>
              <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: tickFontSize }}
              style={{ fontSize: axisFontSize }}
            />
            <YAxis
              tick={{ fontSize: tickFontSize }}
              style={{ fontSize: axisFontSize }}
            />
            <Tooltip
              contentStyle={{ fontSize: tickFontSize }}
            />

            <Area
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              fill="url(#income)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              fill="url(#expenses)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /**
   * ================================
   *  DONUT + BAR VIEW
   * ================================
   */

  const total = expensesByCategory.reduce(
    (sum, item) => sum + item.value,
    0
  );

  return (
    <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Spese per categoria
        </h3>

        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1 text-sm rounded-md ${
              chartType === 'pie'
                ? 'bg-white dark:bg-gray-800 shadow'
                : ''
            }`}
          >
            Donut
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 text-sm rounded-md ${
              chartType === 'bar'
                ? 'bg-white dark:bg-gray-800 shadow'
                : ''
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      {chartType === 'pie' && expensesByCategory.length > 0 && (
        <div className="flex flex-col lg:flex-row items-center gap-10">

          {/* DONUT */}
          <div className="w-full lg:w-1/2 h-[240px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>

                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-900 dark:fill-white text-base font-semibold"
                >
                  €{total.toLocaleString('it-IT')}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* LEGEND */}
          <div className="w-full lg:w-1/2 space-y-3">
            {expensesByCategory.map((item) => {
              const percent = total
                ? ((item.value / total) * 100).toFixed(1)
                : 0;

              return (
                <div
                  key={item.name}
                  className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/40 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">
                      {item.icon} {item.name}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium">
                      €{item.value.toLocaleString('it-IT')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {percent}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {chartType === 'bar' && expensesByCategory.length > 0 && (
        <ResponsiveContainer
          width="100%"
          height={window.innerWidth < 640 ? 220 : 300}
        >
          <BarChart data={expensesByCategory}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
            />
            <YAxis
              tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
            />
            <Tooltip
              contentStyle={{ fontSize: window.innerWidth < 640 ? 11 : 13 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {expensesByCategory.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
