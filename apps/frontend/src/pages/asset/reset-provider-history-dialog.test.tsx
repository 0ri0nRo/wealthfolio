import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetProviderHistoryDialog } from "./reset-provider-history-dialog";
import { RefreshQuotesConfirmDialog } from "./refresh-quotes-confirm-dialog";

const mocks = vi.hoisted(() => ({ resetProviderHistory: vi.fn(), toast: vi.fn() }));
vi.mock("@/adapters", () => ({ resetProviderHistory: mocks.resetProviderHistory }));
vi.mock("@wealthfolio/ui/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ResetProviderHistoryDialog
        assetId="asset-1"
        assetName="Example"
        open
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
  return { client, onOpenChange };
}

const result = {
  assetId: "asset-1",
  source: "YAHOO",
  fromDate: "2020-01-01",
  toDate: "2026-09-17",
  insertedCount: 3,
  deletedCount: 7,
  recalculationPending: false,
};

describe("Reset provider history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetProviderHistory.mockResolvedValue(result);
  });

  it("describes replacement and preserves prices until confirmation; cancellation sends nothing", () => {
    const { onOpenChange } = setup();
    expect(screen.getByText(/replacement may be shorter/)).toHaveTextContent(
      "Manual and broker prices will be preserved",
    );
    expect(mocks.resetProviderHistory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.resetProviderHistory).not.toHaveBeenCalled();
  });

  it("submits only the selected asset once and disables repeat submission while pending", async () => {
    let finish!: (value: typeof result) => void;
    mocks.resetProviderHistory.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setup();
    const confirm = screen.getByRole("button", { name: "Reset provider history" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.resetProviderHistory).toHaveBeenCalledTimes(1));
    expect(mocks.resetProviderHistory).toHaveBeenCalledWith("asset-1");
    expect(screen.getByRole("button", { name: "Resetting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => {
      finish(result);
      await Promise.resolve();
    });
  });

  it("reports committed prices separately from pending recalculation and refreshes caches", async () => {
    mocks.resetProviderHistory.mockResolvedValue({ ...result, recalculationPending: true });
    const { client, onOpenChange } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    fireEvent.click(screen.getByRole("button", { name: "Reset provider history" }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Provider history replaced",
          description:
            "Prices were replaced. Portfolio recalculation is still pending and will be retried automatically. Do not reset again.",
        }),
      ),
    );
    expect(invalidate).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each(["Already refreshing this asset", "Invalid provider history: discarded rows"])(
    "shows backend rejection: %s",
    async (message) => {
      mocks.resetProviderHistory.mockRejectedValue(new Error(message));
      setup();
      fireEvent.click(screen.getByRole("button", { name: "Reset provider history" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(mocks.resetProviderHistory).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "Request timed out",
    "Reset completion could not be confirmed. Reload quotes before retrying.",
  ])("does not retry an uncertain response or claim a rollback: %s", async (message) => {
    mocks.resetProviderHistory.mockRejectedValue(new Error(message));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Reset provider history" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "prices may already have been replaced",
    );
    expect(screen.getByRole("button", { name: "Reset provider history" })).toBeDisabled();
    expect(mocks.resetProviderHistory).toHaveBeenCalledTimes(1);
  });

  it("ordinary refresh confirms merging instead of deletion", () => {
    render(
      <RefreshQuotesConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        assetName="Example"
      />,
    );
    expect(screen.getByText(/merge it with existing prices/)).toHaveTextContent("Older history");
    expect(screen.queryByText(/delete and replace/)).not.toBeInTheDocument();
  });
});
