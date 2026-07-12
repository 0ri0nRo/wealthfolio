import {
  createFormatter,
  dateFnsLocaleFor,
  parseLocalizedDate,
  parseLocalizedNumber,
  resolveFormattingLocale,
} from "@wealthfolio/ui";
import { describe, expect, it } from "vitest";
import { formatOptionSubtitle } from "./occ-symbol";

describe("locale formatting", () => {
  it("fails clearly for missing or invalid required locale configuration", () => {
    expect(() => resolveFormattingLocale(undefined)).toThrow("A formatting locale is required");
    expect(() => resolveFormattingLocale("not_a_locale")).toThrow("Invalid formatting locale");
    expect(() => resolveFormattingLocale("DE")).toThrow(
      "A UI locale is required when resolving a formatting region",
    );
  });

  it("combines UI language with the selected formatting region", () => {
    expect(resolveFormattingLocale("de-DE", "en")).toBe("en-DE");
    expect(resolveFormattingLocale("DE", "en")).toBe("en-DE");
    expect(resolveFormattingLocale("en-US", "fr")).toBe("fr-US");
  });

  it("formats an English UI using the resolved Germany locale", () => {
    const formatter = createFormatter(resolveFormattingLocale("DE", "en"));
    expect(formatter.formatDecimal(1234.56)).toBe("1.234,56");
  });

  it("combines date-fns UI language with regional week conventions", () => {
    const locale = dateFnsLocaleFor("en-DE");
    expect(locale.localize.month(0)).toBe("January");
    expect(locale.options?.weekStartsOn).toBe(1);
    expect(() => dateFnsLocaleFor(undefined)).toThrow("A resolved formatting locale is required");
  });

  it("parses locale-specific grouping and decimal separators", () => {
    expect(parseLocalizedNumber("$1,234.56", "en-US")).toBe(1234.56);
    expect(parseLocalizedNumber("1.234,56 €", "de-DE")).toBe(1234.56);
    expect(parseLocalizedNumber("1\u202f234,56 $", "fr-CA")).toBe(1234.56);
    expect(parseLocalizedNumber("1,234", "en-US")).toBe(1234);
    expect(parseLocalizedNumber("1,234", "de-DE")).toBe(1.234);
    expect(parseLocalizedNumber("-$1,234.56", "en-US")).toBe(-1234.56);
    expect(parseLocalizedNumber(".5", "en-US")).toBe(0.5);
    expect(parseLocalizedNumber("1.", "en-US")).toBe(1);
  });

  it("parses system locales with non-Western grouping and digits", () => {
    expect(parseLocalizedNumber("12,34,567.89", "en-IN")).toBe(1234567.89);
    expect(parseLocalizedNumber("١٬٢٣٤٬٥٦٧٫٨٩", "ar-EG")).toBe(1234567.89);
  });

  it("rejects malformed mixed separators", () => {
    expect(parseLocalizedNumber("1,234.5.6", "en-US")).toBeUndefined();
    expect(parseLocalizedNumber("1,23", "en-US")).toBeUndefined();
    expect(parseLocalizedNumber("1.234,56", "en-US")).toBeUndefined();
    expect(parseLocalizedNumber("abc123", "en-US")).toBeUndefined();
  });

  it("parses ISO before the selected locale date order", () => {
    expect(parseLocalizedDate("2026-07-10", "en-US")?.getDate()).toBe(10);
    expect(parseLocalizedDate("07/10/2026", "en-US")?.getMonth()).toBe(6);
    expect(parseLocalizedDate("10/07/2026", "en-GB")?.getMonth()).toBe(6);
    expect(parseLocalizedDate("2026-07-10T00:00:00.000Z", "en-US")?.toISOString()).toBe(
      "2026-07-10T00:00:00.000Z",
    );
  });

  it("does not apply the configured timezone to calendar dates", () => {
    const formatter = createFormatter("en-CA", "Pacific/Honolulu");
    expect(
      formatter.formatCalendarDate("2026-07-10", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    ).toBe("2026-07-10");
  });

  it("formats the same values according to locale", () => {
    const us = createFormatter("en-US");
    const de = createFormatter("de-DE");
    expect(us.formatDecimal(1234.56)).toBe("1,234.56");
    expect(de.formatDecimal(1234.56)).toBe("1.234,56");
    expect(us.formatDate(new Date(2026, 6, 10), { dateStyle: "short" })).not.toBe(
      de.formatDate(new Date(2026, 6, 10), { dateStyle: "short" }),
    );
  });

  it("preserves currency placement, grouping, signs, compact values, percentages, and quantities", () => {
    const us = createFormatter("en-US");
    const de = createFormatter("de-DE");
    const fr = createFormatter("fr-FR");

    expect(us.formatAmount(-1234.56, "USD")).toBe("-$1,234.56");
    expect(de.formatAmount(1234.56, "EUR")).toMatch(/^1\.234,56\s*€/);
    expect(fr.formatAmount(1234.56, "EUR")).toMatch(/^1[\u00a0\u202f ]234,56\s*€/);
    expect(us.formatCompactAmount(1_250_000, "USD")).toBe("$1.25M");
    expect(fr.formatCompactAmount(1_250_000, "EUR")).toMatch(/^1,25\s*M\s*€/);
    expect(us.formatPercent(-0.125)).toBe("-12.50%");
    expect(fr.formatPercent(0.125)).toMatch(/^12,50[\u00a0\u202f ]%$/);
    expect(us.formatQuantity(1234.56789)).toBe("1,234.56789");
    expect(fr.formatQuantity(1234.56789)).toMatch(/^1[\u00a0\u202f ]234,56789$/);
    expect(us.formatRoundedAmount(1234.56, "GBp")).toBe("1,235p");
    expect(us.formatPercent(0, { signDisplay: "exceptZero" })).toBe("0.00%");
  });

  it("keeps formatter instances isolated and converts timestamps by timezone", () => {
    const losAngeles = createFormatter("en-US", "America/Los_Angeles");
    const tokyo = createFormatter("en-US", "Asia/Tokyo");
    const instant = "2026-07-10T01:30:00.000Z";
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    };

    expect(losAngeles.formatDateTime(instant, options)).toBe("07/09/2026, 18:30");
    expect(tokyo.formatDateTime(instant, options)).toBe("07/10/2026, 10:30");
    expect(losAngeles.formatDecimal(1234.5)).toBe("1,234.5");
    expect(createFormatter("fr-FR").formatDecimal(1234.5)).toMatch(/^1[\u00a0\u202f ]234,5$/);
    expect(losAngeles.formatDecimal(1234.5)).toBe("1,234.5");
  });

  it("injects one formatter into pure formatting helpers", () => {
    const formatting = createFormatter("de-DE");
    expect(formatting.formatAmount(1234.56, "EUR")).toMatch(/1\.234,56/);
    expect(formatting.formatPercent(0.125)).toBe("12,50 %");
    expect(
      formatOptionSubtitle(
        {
          underlying: "AAPL",
          expiration: "2026-07-23",
          strikePrice: 1234.5,
          optionType: "CALL",
        },
        formatting,
      ),
    ).toContain("$1.234,5");
  });
});
