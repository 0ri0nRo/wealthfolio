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

// Colori più sofisticati e in linea con Flexoki
const COLORS = [
  'hsl(25 92% 72%)',   // chart-1
  'hsl(24 81% 61%)',   // chart-2
  'hsl(23 70% 51%)',   // chart-3
  'hsl(23 73% 46%)',   // chart-4
  'hsl(22 80% 41%)',   // chart-5
  'hsl(22 82% 34%)',   // chart-6
  'hsl(22 79% 25%)',   // chart-7
  'hsl(22 75% 20%)',   // chart-8
];

export const BudgetChart: React.FC<BudgetChartProps> = ({
  transactions = [],
  showLast12Months = false,
}) => {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  const expensesByCategory = useMemo(() => {
    type CategoryData = { name: string; value: number; color: string; icon: string };
    const categoryMap = new Map<string, CategoryData>();

    transactions
      .filter((t) => t.type === 'expense' && !isInvestment(t))
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
      if (transaction.type === 'expense' && !isInvestment(transaction)) {
        existing.expenses += transaction.amount;
      }
    });

    return Array.from(monthlyData.values());
  }, [transactions, showLast12Months]);

  if (showLast12Months) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const chartHeight = isMobile ? 180 : 260;
    const tickFontSize = isMobile ? 8 : 11;
    const leftMargin = isMobile ? 0 : 10;

    return (
      <div className="liquid-glass rounded-xl p-3 sm:p-6 border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md">
        <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-4 text-foreground/90">
          Andamento ultimi 12 mesi
        </h3>

        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={last12MonthsData} margin={{ top: 5, right: 5, left: leftMargin, bottom: 0 }}>
            <defs>
              <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--flexoki-gr))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--flexoki-gr))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--flexoki-re))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--flexoki-re))" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="hsl(var(--flexoki-ui-2))" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: tickFontSize, fill: 'hsl(var(--flexoki-tx-2))' }}
              height={isMobile ? 20 : 30}
              stroke="hsl(var(--flexoki-ui-2))"
            />
            <YAxis
              tick={{ fontSize: tickFontSize, fill: 'hsl(var(--flexoki-tx-2))' }}
              width={isMobile ? 40 : 60}
              stroke="hsl(var(--flexoki-ui-2))"
            />
            <Tooltip
              contentStyle={{
                fontSize: tickFontSize,
                backgroundColor: 'hsl(var(--flexoki-bg-2))',
                border: '1px solid hsl(var(--flexoki-ui))',
                borderRadius: '0.5rem',
                padding: '0.5rem',
              }}
            />

            <Area
              type="monotone"
              dataKey="income"
              stroke="hsl(var(--flexoki-gr))"
              fill="url(#income)"
              strokeWidth={isMobile ? 2 : 2.5}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="hsl(var(--flexoki-re))"
              fill="url(#expenses)"
              strokeWidth={isMobile ? 2 : 2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const total = expensesByCategory.reduce((sum, item) => sum + item.value, 0);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const isTablet = typeof window !== 'undefined' && window.innerWidth < 1024;
  const innerRadius = isMobile ? 60 : isTablet ? 80 : 110;
  const outerRadius = isMobile ? 90 : isTablet ? 110 : 150;

  return (
    <div className="liquid-glass rounded-xl p-6 border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground/90">
          Spese per categoria
        </h3>

        <div className="bg-muted/50 rounded-lg p-1 flex backdrop-blur-sm">
          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
              chartType === 'pie'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Donut
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
              chartType === 'bar'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      {chartType === 'pie' && expensesByCategory.length > 0 && (
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* DONUT */}
          <div className="w-full lg:w-1/2 h-[240px] sm:h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      className="transition-opacity hover:opacity-80 cursor-pointer"
                    />
                  ))}
                </Pie>

                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-lg sm:text-2xl font-bold"
                >
                  €{total.toLocaleString('it-IT')}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* LEGEND */}
          <div className="w-full lg:w-1/2 space-y-2.5">
            {expensesByCategory.map((item) => {
              const percent = total ? ((item.value / total) * 100).toFixed(1) : 0;

              return (
                <div
                  key={item.name}
                  className="group flex justify-between items-center bg-muted/30 hover:bg-muted/50 rounded-lg px-4 py-3 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-foreground/90 truncate">
                      {item.icon} {item.name}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold text-foreground">
                      €{item.value.toLocaleString('it-IT')}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
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
          height={window.innerWidth < 640 ? 220 : 400}
        >
          <BarChart data={expensesByCategory}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="hsl(var(--flexoki-ui-2))" />
            <XAxis
              dataKey="name"
              tick={{
                fontSize: window.innerWidth < 640 ? 10 : 12,
                fill: 'hsl(var(--flexoki-tx-2))',
              }}
              stroke="hsl(var(--flexoki-ui-2))"
            />
            <YAxis
              tick={{
                fontSize: window.innerWidth < 640 ? 10 : 12,
                fill: 'hsl(var(--flexoki-tx-2))',
              }}
              stroke="hsl(var(--flexoki-ui-2))"
            />
            <Tooltip
              contentStyle={{
                fontSize: window.innerWidth < 640 ? 11 : 13,
                backgroundColor: 'hsl(var(--flexoki-bg-2))',
                border: '1px solid hsl(var(--flexoki-ui))',
                borderRadius: '0.5rem',
                padding: '0.5rem',
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={800}>
              {expensesByCategory.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.color}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
