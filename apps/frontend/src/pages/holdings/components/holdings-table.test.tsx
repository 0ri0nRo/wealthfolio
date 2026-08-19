import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HoldingType } from "@/lib/constants";
import type { Holding } from "@/lib/types";

import { HoldingsTable } from "./holdings-table";

vi.mock("@wealthfolio/ui/components/ui/data-table", () => ({
  DataTable: ({
    columns,
    data,
  }: {
    columns: { id?: string; accessorFn?: (row: Holding, index: number) => unknown }[];
    data: Holding[];
  }) => {
    const getValue = (id: string) =>
      data[0] == null
        ? undefined
        : columns.find((column) => column.id === id)?.accessorFn?.(data[0], 0);
    const getNumericValue = (id: string) => {
      const value = getValue(id);
      return typeof value === "number" ? value : "";
    };

    return (
      <div>
        <div data-testid="column-ids">{columns.map((column) => column.id).join(",")}</div>
        <div data-testid="closed-cost-basis">{getNumericValue("closedCostBasis")}</div>
        <div data-testid="sale-proceeds">{getNumericValue("saleProceeds")}</div>
      </div>
    );
  },
}));

vi.mock("@/hooks/use-balance-privacy", () => ({
  useBalancePrivacy: () => ({ isBalanceHidden: false }),
}));

vi.mock("@/lib/settings-provider", () => ({
  useSettingsContext: () => ({ settings: { baseCurrency: "USD" } }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));

describe("HoldingsTable columns", () => {
  it("uses market columns for open positions", () => {
    render(<HoldingsTable holdings={[]} isLoading={false} visibilityFilters={["open"]} />);

    const columnIds = screen.getByTestId("column-ids").textContent;
    expect(columnIds).toContain("marketPrice");
    expect(columnIds).toContain("marketValue");
    expect(columnIds).not.toContain("saleProceeds");
  });

  it("uses realized-performance columns for closed positions", () => {
    render(<HoldingsTable holdings={[]} isLoading={false} visibilityFilters={["closed"]} />);

    expect(screen.getByTestId("column-ids")).toHaveTextContent(
      [
        "symbol",
        "openedAt",
        "closedCostBasis",
        "saleProceeds",
        "closedRealizedPnl",
        "realizedReturn",
        "holdingType",
        "currency",
        "actions",
      ].join(","),
    );
  });

  it("derives sale proceeds from disposed cost basis and realized gain", () => {
    const holding: Holding = {
      id: "closed-position",
      accountId: "account-1",
      holdingType: HoldingType.SECURITY,
      isClosed: true,
      quantity: 0,
      localCurrency: "USD",
      baseCurrency: "USD",
      marketValue: { local: 0, base: 0 },
      costBasis: { local: 0, base: 0 },
      returnBasis: { local: 100, base: 125 },
      realizedGain: { local: 20, base: 25 },
      weight: 0,
      asOfDate: "2026-08-18",
    };

    render(<HoldingsTable holdings={[holding]} isLoading={false} visibilityFilters={["closed"]} />);

    expect(screen.getByTestId("closed-cost-basis")).toHaveTextContent("125");
    expect(screen.getByTestId("sale-proceeds")).toHaveTextContent("150");
  });
});
