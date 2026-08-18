import { useQuery } from "@tanstack/react-query";
import { AccountScope, Holding } from "@/lib/types";
import { getHoldingsList } from "@/adapters";
import { QueryKeys } from "@/lib/query-keys";

interface UseHoldingsOptions {
  includeClosed?: boolean;
}

export function useHoldings(accountFilter: AccountScope, options: UseHoldingsOptions = {}) {
  const includeClosed = options.includeClosed ?? false;
  const isEnabled = (() => {
    switch (accountFilter.type) {
      case "account":
        return accountFilter.accountId.trim().length > 0;
      case "accounts":
        return accountFilter.accountIds.length > 0;
      case "portfolio":
        return accountFilter.portfolioId.trim().length > 0;
      case "all":
        return true;
      default:
        return false;
    }
  })();

  const {
    data: holdings = [],
    dataUpdatedAt,
    isLoading,
    isError,
    error,
  } = useQuery<Holding[], Error>({
    queryKey: [QueryKeys.HOLDINGS, accountFilter, { includeClosed }],
    queryFn: () => getHoldingsList(accountFilter, { includeClosed }),
    enabled: isEnabled,
  });

  return { holdings, dataUpdatedAt, isLoading, isError, error };
}
