import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), logger: { error: vi.fn() } }));
vi.mock("./platform", () => mocks);
import { resetProviderHistory } from "./market-data";
it("uses the same reset command and assetId on the platform adapter", async () => {
  mocks.invoke.mockResolvedValue({ assetId: "asset-1" });
  expect(await resetProviderHistory("asset-1")).toEqual({ assetId: "asset-1" });
  expect(mocks.invoke).toHaveBeenCalledWith("reset_provider_history", { assetId: "asset-1" });
});

it("uses the global command without an asset payload", async () => {
  const { resetAllProviderHistory } = await import("./market-data");
  mocks.invoke.mockResolvedValue({
    results: [],
    failures: [],
    skipped: [],
  });
  await resetAllProviderHistory();
  expect(mocks.invoke).toHaveBeenCalledWith("reset_all_provider_history");
});
