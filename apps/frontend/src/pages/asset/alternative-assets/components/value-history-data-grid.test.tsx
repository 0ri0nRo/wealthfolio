import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { format } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIsMobileViewport } from "@/hooks/use-platform";
import type { Quote } from "@/lib/types";

import { ValueHistoryDataGrid } from "./value-history-data-grid";

vi.mock("@/hooks/use-platform", () => ({
  useIsMobileViewport: vi.fn(),
}));

vi.mock("@wealthfolio/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wealthfolio/ui")>();
  return {
    ...actual,
    useDataGrid: () => ({
      table: {
        getSelectedRowModel: () => ({ rows: [] }),
        resetRowSelection: vi.fn(),
      },
      onRowAdd: vi.fn(),
    }),
  };
});

const mockUseIsMobileViewport = vi.mocked(useIsMobileViewport);
const assetId = "asset-home-mortgage";

const createQuote = (date: string, value: number): Quote => ({
  id: `${assetId}_${date}_MANUAL`,
  createdAt: `${date}T00:00:00.000Z`,
  dataSource: "MANUAL",
  timestamp: `${date}T00:00:00Z`,
  assetId,
  open: value,
  high: value,
  low: value,
  volume: 0,
  close: value,
  adjclose: value,
  currency: "USD",
  notes: undefined,
});

interface RenderGridOptions {
  data?: Quote[];
  onSaveQuote?: (quote: Quote) => Promise<void>;
  onDeleteQuote?: (quoteId: string) => Promise<void>;
}

const renderGrid = ({
  data = [createQuote("2026-08-17", 495_000)],
  onSaveQuote = vi.fn().mockResolvedValue(undefined),
  onDeleteQuote = vi.fn().mockResolvedValue(undefined),
}: RenderGridOptions = {}) => {
  render(
    <ValueHistoryDataGrid
      data={data}
      assetId={assetId}
      currency="USD"
      isLiability
      onSaveQuote={onSaveQuote}
      onDeleteQuote={onDeleteQuote}
    />,
  );
};

describe("ValueHistoryDataGrid mobile", () => {
  beforeEach(() => {
    mockUseIsMobileViewport.mockReturnValue(true);
  });

  it("provides contextual row actions and a labelled notes field", () => {
    renderGrid();

    expect(
      screen.getByRole("button", { name: "Edit 2026-08-17, $495,000.00" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete 2026-08-17, $495,000.00" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit 2026-08-17, $495,000.00" }));

    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("persists a canonical manual quote before committing the edited row", async () => {
    const onSaveQuote = vi.fn().mockResolvedValue(undefined);
    renderGrid({ onSaveQuote });

    fireEvent.click(screen.getByRole("button", { name: "Edit 2026-08-17, $495,000.00" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Balance" }), {
      target: { value: "510000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveQuote).toHaveBeenCalledTimes(1));
    expect(onSaveQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `${assetId}_2026-08-17_MANUAL`,
        assetId,
        close: 510_000,
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Edit 2026-08-17, $510,000.00" }),
    ).toBeInTheDocument();
  });

  it("keeps the draft open when saving fails", async () => {
    const onSaveQuote = vi.fn().mockRejectedValue(new Error("save failed"));
    renderGrid({ onSaveQuote });

    fireEvent.click(screen.getByRole("button", { name: "Edit 2026-08-17, $495,000.00" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Balance" }), {
      target: { value: "510000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveQuote).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Balance" })).toHaveValue("510,000.00");
  });

  it("keeps the row and confirmation open when deletion fails", async () => {
    const onDeleteQuote = vi.fn().mockRejectedValue(new Error("delete failed"));
    renderGrid({ onDeleteQuote });

    fireEvent.click(screen.getByRole("button", { name: "Delete 2026-08-17, $495,000.00" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete history entry?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleteQuote).toHaveBeenCalledTimes(1));
    const openDialog = screen.getByRole("alertdialog", { name: "Delete history entry?" });
    expect(openDialog).toBeInTheDocument();
    fireEvent.click(within(openDialog).getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: "Edit 2026-08-17, $495,000.00" }),
    ).toBeInTheDocument();
  });

  it("uses the explicit asset ID when saving the first history entry", async () => {
    const onSaveQuote = vi.fn().mockResolvedValue(undefined);
    renderGrid({ data: [], onSaveQuote });

    fireEvent.click(screen.getByRole("button", { name: "Add Balance" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveQuote).toHaveBeenCalledTimes(1));
    const today = format(new Date(), "yyyy-MM-dd");
    expect(onSaveQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `${assetId}_${today}_MANUAL`,
        assetId,
      }),
    );
  });

  it("replaces an existing entry when adding another balance for the same day", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const onSaveQuote = vi.fn().mockResolvedValue(undefined);
    renderGrid({ data: [createQuote(today, 495_000)], onSaveQuote });

    fireEvent.click(screen.getByRole("button", { name: "Add Balance" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Balance" }), {
      target: { value: "490000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("button", { name: `Edit ${today}, $490,000.00` }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: new RegExp(`^Edit ${today},`) })).toHaveLength(1);
  });
});
