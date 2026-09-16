import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  useNetWorth: vi.fn(),
  useNetWorthHistory: vi.fn(),
}));
const intervalMocks = vi.hoisted(() => ({
  period: "ALL" as "ALL" | "1M",
  range: undefined as { from: Date; to?: Date } | undefined,
}));

vi.mock("@/hooks/use-alternative-assets", () => queryMocks);
vi.mock("@/hooks/use-portfolio-allocations", () => ({
  usePortfolioAllocations: () => ({ allocations: undefined }),
}));
vi.mock("@/hooks/use-platform", () => ({ useIsMobileViewport: () => false }));
vi.mock("@/lib/net-worth-category-label", () => ({
  getNetWorthCategoryLabel: (_t: unknown, _category: string, name: string) => name,
}));
vi.mock("@/lib/settings-provider", () => ({
  useSettingsContext: () => ({ settings: { baseCurrency: "USD" } }),
}));
vi.mock("@/components/dashboard-card", () => ({
  DashboardCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/pages/dashboard/balance", () => ({ default: () => <div /> }));
vi.mock("@/pages/holdings/components/allocation-detail-sheet", () => ({
  AllocationDetailSheet: () => null,
}));
vi.mock("./components/breakdown-table", () => ({ BreakdownTable: () => <div /> }));
vi.mock("./components/category-detail-sheet", () => ({ CategoryDetailSheet: () => null }));
vi.mock("./components/momentum-card", () => ({ MomentumCard: () => null }));
vi.mock("./components/velocity-card", () => ({ VelocityCard: () => null }));
vi.mock("./net-worth-chart", () => ({ NetWorthChart: () => null }));
vi.mock("@wealthfolio/ui", () => ({
  GainAmount: () => null,
  GainPercent: () => null,
  IntervalSelector: () => null,
  getInitialIntervalData: () => ({ range: intervalMocks.range }),
  useNumberFormatting: () => ({}),
  usePersistentState: () => [intervalMocks.period, vi.fn()],
}));
vi.mock("@wealthfolio/ui/components/ui/icons", () => ({
  Icons: { TrendingUp: () => null },
}));
vi.mock("@wealthfolio/ui/components/ui/skeleton", () => ({ Skeleton: () => null }));
vi.mock("@wealthfolio/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { NetWorthContent } from "./net-worth-content";

function latestEnabledHistoryCall() {
  return queryMocks.useNetWorthHistory.mock.calls
    .filter(([options]) => options.enabled)
    .at(-1)?.[0];
}

function latestEnabledHistoryCalls(count: number) {
  return queryMocks.useNetWorthHistory.mock.calls
    .filter(([options]) => options.enabled)
    .slice(-count)
    .map(([options]) => options);
}

describe("NetWorthContent current-date queries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 12));
    intervalMocks.period = "ALL";
    intervalMocks.range = { from: new Date(2026, 8, 1), to: undefined };
    queryMocks.useNetWorth.mockReturnValue({
      data: {
        netWorth: "100",
        assets: { total: "100", breakdown: [] },
        liabilities: { total: "0", breakdown: [] },
        currency: "USD",
        staleAssets: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    queryMocks.useNetWorthHistory.mockReturnValue({ data: [], isLoading: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each([
    ["start", new Date(2026, 8, 15, 0, 30)],
    ["middle", new Date(2026, 8, 15, 12)],
    ["end", new Date(2026, 8, 15, 23, 30)],
  ])("requests the current local day at the %s of that day", (_partOfDay, now) => {
    vi.setSystemTime(now);

    render(<NetWorthContent />);

    expect(latestEnabledHistoryCall()?.endDate).toBe("2026-09-15");
    expect(queryMocks.useNetWorth).toHaveBeenLastCalledWith({ date: "2026-09-15" });
  });

  it("advances the summary and open-ended history after local midnight", async () => {
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 59, 900));
    render(<NetWorthContent />);

    expect(latestEnabledHistoryCall()?.endDate).toBe("2026-09-15");
    expect(queryMocks.useNetWorth).toHaveBeenLastCalledWith({ date: "2026-09-15" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(latestEnabledHistoryCall()?.endDate).toBe("2026-09-16");
    expect(queryMocks.useNetWorth).toHaveBeenLastCalledWith({ date: "2026-09-16" });
  });

  it("keeps an explicit history range independent from the current local day", async () => {
    intervalMocks.range = {
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31),
    };
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 59, 900));
    render(<NetWorthContent />);

    expect(latestEnabledHistoryCall()?.endDate).toBe("2026-01-31");
    expect(queryMocks.useNetWorth).toHaveBeenLastCalledWith({ date: "2026-09-15" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(latestEnabledHistoryCall()?.endDate).toBe("2026-01-31");
    expect(queryMocks.useNetWorth).toHaveBeenLastCalledWith({ date: "2026-09-16" });
  });

  it("advances both open-ended history queries and schedules the following rollover", async () => {
    intervalMocks.period = "1M";
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 59, 900));
    render(<NetWorthContent />);

    expect(latestEnabledHistoryCalls(2).map(({ endDate }) => endDate)).toEqual([
      "2026-09-15",
      "2026-09-15",
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(latestEnabledHistoryCalls(2).map(({ endDate }) => endDate)).toEqual([
      "2026-09-16",
      "2026-09-16",
    ]);
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    });

    expect(queryMocks.useNetWorth).toHaveBeenLastCalledWith({ date: "2026-09-17" });
    expect(latestEnabledHistoryCalls(2).map(({ endDate }) => endDate)).toEqual([
      "2026-09-17",
      "2026-09-17",
    ]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("clears the local-midnight timer when the page unmounts", () => {
    const { unmount } = render(<NetWorthContent />);

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
