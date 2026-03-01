import { useNetWorth, useNetWorthHistory } from '@/hooks/use-alternative-assets';
import { NetWorthHistoryPoint } from '@/lib/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '../adapters/shared/platform';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FireSettings {
  monthly_expenses:         number;
  monthly_income_override:  number | null;  // manual override; null = use budget average
  inps_monthly:             number;
  fire_number:              number | null;  // null = auto: expenses × 12 × 25
  annual_return_rate:       number;
  inflation_rate:           number;
  current_age:              number | null;
  target_fire_age:          number | null;
}

export interface RunwayScenario {
  label:       string;
  months:      number;
  description: string;
}

export interface FireScenario {
  label:          string;
  monthly_target: number;
  fire_number:    number;
  months_to_fire: number | null;
  years_to_fire:  number | null;
}

export interface NetWorthPoint {
  date:        string;
  total_value: number;
}

export interface FireData {
  net_worth:              number;
  avg_monthly_expenses:   number;
  avg_monthly_income:     number;
  avg_monthly_savings:    number;
  savings_rate:           number;
  freedom_score:          number;
  runway_scenarios:       RunwayScenario[];
  fire_scenarios:         FireScenario[];
  net_worth_history:      NetWorthPoint[];
  settings:               FireSettings;
}

// Internal shape returned by the backend — no net-worth data included
interface BudgetFireData {
  avg_monthly_expenses: number;
  avg_monthly_income:   number;
  avg_monthly_savings:  number;
  savings_rate:         number;
  runway_scenarios:     RunwayScenario[];
  fire_scenarios:       FireScenario[];
  settings:             FireSettings;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns months until FIRE given current net worth, monthly savings, target and annual return.
 *  Returns 0 if already reached, null if never reachable (zero/negative savings). */
function monthsToFire(
  netWorth:      number,
  monthlySavings: number,
  fireNumber:    number,
  annualReturn:  number,
): number | null {
  if (fireNumber <= 0 || netWorth >= fireNumber) return 0;
  if (monthlySavings <= 0) return null;

  const r = annualReturn / 12;
  if (r === 0) return (fireNumber - netWorth) / monthlySavings;

  const numerator = ((fireNumber - netWorth) * r + monthlySavings) / monthlySavings;
  if (numerator <= 0) return null;

  const n = Math.log(numerator) / Math.log(1 + r);
  return n < 0 ? null : n;
}

const INF_MONTHS = 9999;

function computeFireData(
  netWorth:                    number,
  netWorthHistory:             NetWorthPoint[],
  settings:                    FireSettings,
  avgMonthlyIncomeFromBudget:  number,
  avgMonthlyExpensesFromBudget: number,
): FireData {
  const avgMonthlyIncome   = settings.monthly_income_override ?? avgMonthlyIncomeFromBudget;
  const avgMonthlyExpenses = settings.monthly_expenses;

  // Savings uses actual budget expenses (not the target spending override)
  const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpensesFromBudget;
  const savingsRate = avgMonthlyIncome > 0
    ? Math.min(Math.max((avgMonthlySavings / avgMonthlyIncome) * 100, 0), 100)
    : 0;

  const fireNumber   = settings.fire_number ?? avgMonthlyExpenses * 12 * 25;
  const freedomScore = fireNumber > 0 ? Math.min((netWorth / fireNumber) * 100, 100) : 0;

  const annualReturn   = settings.annual_return_rate;
  const monthlyPassive = (netWorth * annualReturn) / 12;

  // ── Runway scenarios ────────────────────────────────────────────────────────
  const runwayCapitalOnly = avgMonthlyExpenses > 0
    ? netWorth / avgMonthlyExpenses
    : 0;

  const netExpensesWithInps = avgMonthlyExpenses - settings.inps_monthly;
  const runwayWithInps = netExpensesWithInps > 0
    ? netWorth / netExpensesWithInps
    : Infinity;

  const netExpensesWithReturns = avgMonthlyExpenses - monthlyPassive;
  const runwayWithReturns = netExpensesWithReturns > 0
    ? netWorth / netExpensesWithReturns
    : Infinity;

  const runwayScenarios: RunwayScenario[] = [
    {
      label:       'Capital only',
      months:      runwayCapitalOnly,
      description: 'No income whatsoever — pure drawdown',
    },
    {
      label:       'With INPS benefit',
      months:      runwayWithInps === Infinity ? INF_MONTHS : runwayWithInps,
      description: `Includes unemployment benefit of €${settings.inps_monthly.toFixed(0)}/mo`,
    },
    {
      label:       'With investment returns',
      months:      runwayWithReturns === Infinity ? INF_MONTHS : runwayWithReturns,
      description: `Portfolio compounding at ${(annualReturn * 100).toFixed(0)}%/yr offsets expenses`,
    },
  ];

  // ── FIRE scenarios ──────────────────────────────────────────────────────────
  const makeFireScenario = (label: string, monthlyTarget: number): FireScenario => {
    const fn  = monthlyTarget * 12 * 25;
    const mtf = monthsToFire(netWorth, Math.max(avgMonthlySavings, 0), fn, annualReturn);
    return {
      label,
      monthly_target: monthlyTarget,
      fire_number:    fn,
      months_to_fire: mtf,
      years_to_fire:  mtf !== null ? mtf / 12 : null,
    };
  };

  return {
    net_worth:            netWorth,
    avg_monthly_expenses: avgMonthlyExpenses,
    avg_monthly_income:   avgMonthlyIncome,
    avg_monthly_savings:  avgMonthlySavings,
    savings_rate:         savingsRate,
    freedom_score:        freedomScore,
    runway_scenarios:     runwayScenarios,
    fire_scenarios: [
      makeFireScenario('Lean FIRE',    avgMonthlyExpenses * 0.7),
      makeFireScenario('Regular FIRE', avgMonthlyExpenses),
      makeFireScenario('Fat FIRE',     avgMonthlyExpenses * 1.5),
    ],
    net_worth_history: netWorthHistory,
    settings,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useFire = () => {
  const [budgetData, setBudgetData] = useState<BudgetFireData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);

  // Reuse the same net-worth hooks as the dashboard for consistency
  const { data: netWorthData,       isLoading: isLoadingNW      } = useNetWorth();
  const { data: netWorthHistoryRaw, isLoading: isLoadingHistory } = useNetWorthHistory({
    startDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d.toISOString().split('T')[0]; })(),
    endDate:   new Date().toISOString().split('T')[0],
  });

  const fetchBudgetData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<BudgetFireData>('get_fire_data');
      setBudgetData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FIRE data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBudgetData(); }, [fetchBudgetData]);

  // Derived — recomputed only when inputs change, never on render
  const data: FireData | null = useMemo(() => {
    if (!budgetData || !netWorthData) return null;

    const netWorth = parseFloat(netWorthData.netWorth) || 0;
    const netWorthHistory: NetWorthPoint[] = (netWorthHistoryRaw ?? []).map(
      (p: NetWorthHistoryPoint) => ({
        date:        p.date,
        total_value: parseFloat(p.portfolioValue)
                   + parseFloat(p.alternativeAssetsValue)
                   - parseFloat(p.totalLiabilities),
      }),
    );

    return computeFireData(
      netWorth,
      netWorthHistory,
      budgetData.settings,
      budgetData.avg_monthly_income,
      budgetData.avg_monthly_expenses,
    );
  }, [budgetData, netWorthData, netWorthHistoryRaw]);

  const saveSettings = useCallback(async (settings: FireSettings) => {
    setSaving(true);
    try {
      await invoke('save_fire_settings', settings as unknown as Record<string, unknown>);
      await fetchBudgetData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [fetchBudgetData]);

  return {
    data,
    loading: loading || isLoadingNW || isLoadingHistory,
    error,
    saving,
    refresh:      fetchBudgetData,
    saveSettings,
  };
};
