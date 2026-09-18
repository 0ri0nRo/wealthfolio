import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "./core";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("sends reset as an explicit POST for exactly one asset and returns committed state", async () => {
  const result = {
    assetId: "FX:USD/EUR",
    source: "YAHOO",
    fromDate: "2020-01-01",
    toDate: "2026-09-17",
    insertedCount: 3,
    deletedCount: 7,
  };
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  expect(await invoke("reset_provider_history", { assetId: "FX:USD/EUR" })).toEqual(result);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1/market-data/quotes/FX%3AUSD%2FEUR/reset");
  expect(options?.method).toBe("POST");
  expect(options?.body).toBeUndefined();
});

it("posts the global reset exactly once without a selected asset", async () => {
  const result = { results: [], failures: [], skipped: [] };
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
  expect(url).toBe("/api/v1/market-data/quotes/reset");
  expect(options?.method).toBe("POST");
  expect(options?.body ?? "").not.toContain("assetId");
});
