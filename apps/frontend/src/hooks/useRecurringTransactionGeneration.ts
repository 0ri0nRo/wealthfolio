// src/hooks/useRecurringTransactionGeneration.ts

import { BudgetTransaction } from '@/lib/types/budget';
import { RecurringExpense, frequencyToDays } from '@/lib/types/recurring';

interface UseRecurringTransactionGenerationProps {
  recurringExpenses: RecurringExpense[];
  allTransactions: BudgetTransaction[];
  createTransaction: (data: {
    categoryId: number;
    amount: number;
    type: 'income' | 'expense';
    description: string;
    date: string;
    notes?: string;
  }) => Promise<void>;
}

export const useRecurringTransactionGeneration = (
  props: UseRecurringTransactionGenerationProps
) => {
  const { recurringExpenses, allTransactions, createTransaction } = props;

  const shouldHaveTransaction = (
    recurring: RecurringExpense,
    date: Date
  ): boolean => {
    const startDate = new Date(recurring.startDate);

    if (date < startDate) return false;

    if (recurring.endDate) {
      const endDate = new Date(recurring.endDate);
      if (date > endDate) return false;
    }

    const daysDiff = Math.floor(
      (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const frequencyDays = frequencyToDays(recurring.frequency, recurring.customDays);

    return daysDiff % frequencyDays === 0;
  };

  const transactionExists = (
    recurringId: string | number,
    date: Date
  ): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return allTransactions.some(tx => {
      const txDate = new Date(tx.date).toISOString().split('T')[0];
      return txDate === dateStr && tx.notes?.includes(`recurring:${recurringId}`);
    });
  };

  const generateTransactionsForMonth = async (
    month: Date = new Date()
  ): Promise<number> => {
    let generatedCount = 0;
    const year = month.getFullYear();
    const monthNum = month.getMonth();

    const daysInMonth = new Date(year, monthNum + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, monthNum, day);

      for (const recurring of recurringExpenses) {
        if (!recurring.isActive) continue;
        if (transactionExists(recurring.id, currentDate)) continue;
        if (!shouldHaveTransaction(recurring, currentDate)) continue;

        try {
          await createTransaction({
            categoryId: recurring.categoryId,
            amount: recurring.amount,
            type: 'expense',
            description: recurring.description,
            date: currentDate.toISOString().split('T')[0],
            notes: `recurring:${recurring.id}${recurring.notes ? ` - ${recurring.notes}` : ''}`,
          });

          generatedCount++;
        } catch (error) {
          console.error(
            `Failed to generate transaction for recurring ${recurring.id}:`,
            error
          );
        }
      }
    }

    return generatedCount;
  };

  const generateTransactionsForDateRange = async (
    startDate: Date,
    endDate: Date
  ): Promise<number> => {
    let generatedCount = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      for (const recurring of recurringExpenses) {
        if (!recurring.isActive) continue;
        if (transactionExists(recurring.id, currentDate)) continue;
        if (!shouldHaveTransaction(recurring, currentDate)) continue;

        try {
          await createTransaction({
            categoryId: recurring.categoryId,
            amount: recurring.amount,
            type: 'expense',
            description: recurring.description,
            date: currentDate.toISOString().split('T')[0],
            notes: `recurring:${recurring.id}${recurring.notes ? ` - ${recurring.notes}` : ''}`,
          });

          generatedCount++;
        } catch (error) {
          console.error(
            `Failed to generate transaction for recurring ${recurring.id}:`,
            error
          );
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return generatedCount;
  };

  const getNextOccurrence = (recurring: RecurringExpense): Date | null => {
    if (!recurring.isActive) return null;
    if (recurring.endDate && new Date() > new Date(recurring.endDate)) {
      return null;
    }

    const startDate = new Date(recurring.startDate);
    const frequencyDays = frequencyToDays(recurring.frequency, recurring.customDays);
    let nextDate = new Date(startDate);

    while (nextDate <= new Date()) {
      nextDate.setDate(nextDate.getDate() + frequencyDays);
    }

    if (recurring.endDate && nextDate > new Date(recurring.endDate)) {
      return null;
    }

    return nextDate;
  };

  return {
    shouldHaveTransaction,
    transactionExists,
    generateTransactionsForMonth,
    generateTransactionsForDateRange,
    getNextOccurrence,
  };
};

export const useAutoGenerateRecurringTransactions = (
  recurring: RecurringExpense[],
  allTransactions: BudgetTransaction[],
  createTransaction: (data: any) => Promise<void>,
  selectedMonth: Date
) => {
  const generation = useRecurringTransactionGeneration({
    recurringExpenses: recurring,
    allTransactions,
    createTransaction,
  });

  React.useEffect(() => {
    generation.generateTransactionsForMonth(selectedMonth).catch(console.error);
  }, [selectedMonth, recurring.length]);

  return generation;
};

import React from 'react';
