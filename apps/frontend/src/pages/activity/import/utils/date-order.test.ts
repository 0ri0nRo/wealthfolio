import { format as formatDate } from "date-fns";
import { describe, expect, it } from "vitest";

import { detectDateOrder, isAmbiguousNumericDate, tryParseDate } from "@/lib/utils";
import { HoldingsFormat } from "../steps/holdings-mapping-step";
import { analyzeDateColumn, parseDateToYMD } from "./holdings-import-utils";

describe("detectDateOrder", () => {
  it("reads a column as day-first when a day exceeds 12", () => {
    expect(detectDateOrder(["03/08/2026", "26/06/2026"])).toBe("DMY");
  });

  it("reads a column as month-first when the second field exceeds 12", () => {
    expect(detectDateOrder(["03/08/2026", "06/26/2026"])).toBe("MDY");
  });

  it("returns null when every value could be read either way", () => {
    expect(detectDateOrder(["03/08/2026", "10/06/2026"])).toBeNull();
  });

  it("returns null when the column contradicts itself", () => {
    expect(detectDateOrder(["26/06/2026", "06/26/2026"])).toBeNull();
  });

  it("ignores values that are not numeric dates", () => {
    expect(detectDateOrder(["2026-08-03", "", "not a date"])).toBeNull();
  });

  it("handles dot and dash separators", () => {
    expect(detectDateOrder(["13.08.2026"])).toBe("DMY");
    expect(detectDateOrder(["08-13-2026"])).toBe("MDY");
  });

  it("does not mix separators within one value", () => {
    expect(detectDateOrder(["13/08-2026"])).toBeNull();
  });
});

describe("isAmbiguousNumericDate", () => {
  it("flags values whose leading fields are both <= 12", () => {
    expect(isAmbiguousNumericDate("03/08/2026")).toBe(true);
  });

  it("does not flag values a day field already resolves", () => {
    expect(isAmbiguousNumericDate("26/06/2026")).toBe(false);
  });

  it("does not flag ISO dates", () => {
    expect(isAmbiguousNumericDate("2026-08-03")).toBe(false);
  });
});

describe("parseDateToYMD", () => {
  it("honours a resolved day-first order", () => {
    expect(parseDateToYMD("03/08/2026", "auto", "DMY")).toBe("2026-08-03");
  });

  it("keeps month-first when no order was resolved", () => {
    expect(parseDateToYMD("03/08/2026", "auto")).toBe("2026-03-08");
  });

  it("lets an explicit preset win over a resolved order", () => {
    expect(parseDateToYMD("03/08/2026", "MM/DD/YYYY", "DMY")).toBe("2026-03-08");
  });

  it("leaves ISO dates alone", () => {
    expect(parseDateToYMD("2026-08-03", "auto", "DMY")).toBe("2026-08-03");
  });

  it("leaves the existing dot-date reading alone when no order was resolved", () => {
    // Regression guard: "auto" must stay byte-for-byte the historical order,
    // where dd.MM precedes MM.dd.
    expect(parseDateToYMD("01.05.2024", "auto")).toBe("2024-05-01");
  });

  it("refuses a numeric date no pattern matched rather than guessing", () => {
    // 33 is not a day and not a month; the Date constructor would still invent
    // something engine-specific here.
    expect(parseDateToYMD("33/33/2026", "auto")).toBeNull();
  });
});

describe("tryParseDate", () => {
  // tryParseDate returns a local-midnight Date, so compare in local time —
  // toISOString would shift the day for any positive UTC offset.
  const ymd = (date: Date | null) => (date ? formatDate(date, "yyyy-MM-dd") : null);

  it("honours a resolved day-first order", () => {
    expect(ymd(tryParseDate("03/08/2026", "DMY"))).toBe("2026-08-03");
  });

  it("is unchanged without an order", () => {
    expect(ymd(tryParseDate("03/08/2026"))).toBe("2026-03-08");
  });

  it("still parses European dot dates when the order is month-first", () => {
    expect(ymd(tryParseDate("01.05.2024", "MDY"))).toBe("2024-05-01");
  });
});

describe("analyzeDateColumn", () => {
  const headers = ["data", "isin", "qty"];
  const mapping = { [HoldingsFormat.DATE]: "data" };

  it("resolves the order from the column and asks for nothing", () => {
    const rows = [
      ["03/08/2026", "IT0005425761", "8000"],
      ["26/06/2026", "IT0005425761", "8000"],
    ];
    expect(analyzeDateColumn(headers, rows, mapping, "auto")).toEqual({
      order: "DMY",
      needsExplicitFormat: false,
    });
  });

  it("asks for an explicit format when the whole column is ambiguous", () => {
    // The real case: a statement whose every row carries one date, 3 August.
    const rows = [
      ["03/08/2026", "IT0005425761", "8000"],
      ["03/08/2026", "DE000WA7T3D8", "3"],
    ];
    expect(analyzeDateColumn(headers, rows, mapping, "auto")).toEqual({
      needsExplicitFormat: true,
      ambiguousSample: "03/08/2026",
    });
  });

  it("stays quiet once the user picked a format", () => {
    const rows = [["03/08/2026", "IT0005425761", "8000"]];
    expect(analyzeDateColumn(headers, rows, mapping, "DD/MM/YYYY")).toEqual({
      needsExplicitFormat: false,
    });
  });

  it("stays quiet when the date column is not mapped", () => {
    const rows = [["03/08/2026", "IT0005425761", "8000"]];
    expect(analyzeDateColumn(headers, rows, {}, "auto")).toEqual({
      needsExplicitFormat: false,
    });
  });

  it("stays quiet for ISO columns", () => {
    const rows = [["2026-08-03", "IT0005425761", "8000"]];
    expect(analyzeDateColumn(headers, rows, mapping, "auto")).toEqual({
      needsExplicitFormat: false,
    });
  });
});
