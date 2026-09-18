import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), logger: { error: vi.fn() } }));
vi.mock("./platform", () => mocks);
import { resetProviderHistory } from "./market-data";
it("uses the same reset command and assetId on the platform adapter", async () => {
  mocks.invoke.mockResolvedValue({ recalculationPending: true });
  expect(await resetProviderHistory("asset-1")).toEqual({ recalculationPending: true });
  expect(mocks.invoke).toHaveBeenCalledWith("reset_provider_history", { assetId: "asset-1" });
});
