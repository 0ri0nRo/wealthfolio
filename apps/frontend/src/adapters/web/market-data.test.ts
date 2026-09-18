import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "./core";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("sends reset as an explicit POST for exactly one asset and returns committed state", async () => {
  const result = {
    assetId: "asset-1",
    source: "YAHOO",
    fromDate: "2020-01-01",
    toDate: "2026-09-17",
    insertedCount: 3,
    deletedCount: 7,
    recalculationPending: true,
  };
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  expect(await invoke("reset_provider_history", { assetId: "asset-1" })).toEqual(result);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/market-data/quotes/reset-provider-history");
  expect(options?.method).toBe("POST");
  expect(options?.body).toBe(JSON.stringify({ assetId: "asset-1" }));
});

it("posts the global reset exactly once without a selected asset", async () => {
  const result = { results: [], failures: [], skipped: [], recalculationPending: false };
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  expect(await invoke("reset_all_provider_history")).toEqual(result);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/market-data/quotes/reset-all-provider-history");
  expect(options?.method).toBe("POST");
  expect(options?.body ?? "").not.toContain("assetId");
});
