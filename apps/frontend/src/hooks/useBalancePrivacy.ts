// src/hooks/useBalancePrivacy.ts
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'budget_balance_hidden';

export const useBalancePrivacy = () => {
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleBalanceVisibility = useCallback(() => {
    setIsBalanceHidden(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setIsBalanceHidden(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { isBalanceHidden, toggleBalanceVisibility };
};
