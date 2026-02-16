// src/pages/Budget/components/BudgetSummaryCards.tsx
import { BudgetSummary } from '@/lib/types/budget';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import React from 'react';

interface BudgetSummaryCardsProps {
  summary: BudgetSummary | null;
  isLoading?: boolean;
}

export const BudgetSummaryCards: React.FC<BudgetSummaryCardsProps> = ({ summary, isLoading }) => {
  const income = summary?.totalIncome ?? 0;
  const expenses = summary?.totalExpenses ?? 0;
  const balance = income - expenses;

  const cards = [
    {
      label: 'Income',
      value: income,
      icon: TrendingUp,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-900/10',
    },
    {
      label: 'Expenses',
      value: expenses,
      icon: TrendingDown,
      colorClass: 'text-rose-600 dark:text-rose-400',
      bgClass: 'bg-rose-50 dark:bg-rose-900/10',
    },
    {
      label: 'Balance',
      value: balance,
      icon: Wallet,
      colorClass: balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
      bgClass: balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-orange-50 dark:bg-orange-900/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-20 animate-pulse rounded-md md:h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`bg-background border-border flex flex-col justify-between rounded-md border p-3 md:p-4 ${
            index === 2 ? 'col-span-2 md:col-span-1' : ''
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium md:text-xs">{card.label}</span>
            <div className={`flex h-6 w-6 items-center justify-center rounded-full md:h-7 md:w-7 ${card.bgClass}`}>
              <card.icon className={`h-3 w-3 md:h-3.5 md:w-3.5 ${card.colorClass}`} />
            </div>
          </div>
          <div>
            <p className={`text-lg font-bold md:text-2xl ${card.colorClass}`}>
              €{card.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
