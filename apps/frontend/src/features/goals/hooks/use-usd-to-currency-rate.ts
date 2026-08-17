import { getExchangeRates } from "@/adapters";
import { QueryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Resolves an already-tracked USD -> currency exchange rate.
 * Returns 1 when currency is USD, or undefined when no rate is tracked yet
 * (callers should treat undefined as "unknown scale" rather than guess).
 */
export function useUsdToCurrencyRate(currency: string): number | undefined {
  const { data: exchangeRates } = useQuery({
    queryKey: [QueryKeys.EXCHANGE_RATES],
    queryFn: getExchangeRates,
    enabled: currency !== "USD",
  });

  return useMemo(() => {
    if (currency === "USD") return 1;
    if (!exchangeRates) return undefined;
    const direct = exchangeRates.find((r) => r.fromCurrency === "USD" && r.toCurrency === currency);
    if (direct) return direct.rate;
    const inverse = exchangeRates.find(
      (r) => r.fromCurrency === currency && r.toCurrency === "USD",
    );
    return inverse?.rate ? 1 / inverse.rate : undefined;
  }, [exchangeRates, currency]);
}

/** Converts a USD amount to its currency equivalent, or undefined if the rate is unknown. */
export function usdEquivalent(usdAmount: number, usdToCurrencyRate: number | undefined) {
  return usdToCurrencyRate === undefined ? undefined : Math.round(usdAmount * usdToCurrencyRate);
}
