import { describe, expect, it } from "vitest";
import {
  calculateTradeFinalAmount,
  calculateTradeFinalCash,
  resolveActivityCashMultiplier,
} from "./activity-final-amount";
import { ActivityType } from "./constants";

describe("resolveActivityCashMultiplier", () => {
  it("keeps the lockstep defaults with Asset::contract_multiplier", () => {
    expect(resolveActivityCashMultiplier("EQUITY")).toBe(1);
    expect(resolveActivityCashMultiplier("OPTION")).toBe(100);
    // Bonds deliberately default to 1: provider quotes are fraction-of-par,
    // so a 0.01 default would double-apply the /100 (the 1/100 valuation
    // bug). Percent-of-par is opt-in via explicit metadata.
    expect(resolveActivityCashMultiplier("BOND")).toBe(1);
  });

  it("lets an explicit multiplier win over every default", () => {
    expect(resolveActivityCashMultiplier("BOND", 0.01)).toBe(0.01);
    expect(resolveActivityCashMultiplier("OPTION", 10)).toBe(10);
    expect(resolveActivityCashMultiplier("EQUITY", "50")).toBe(50);
  });
});

describe("calculateTradeFinalAmount for bonds", () => {
  it("prices a default bond in fraction-of-par like its provider quotes", () => {
    // Face qty 10,000 at 0.985 of par, fee 5: final = 9,850 + 5.
    expect(
      calculateTradeFinalAmount({
        activityType: ActivityType.BUY,
        instrumentType: "BOND",
        quantity: 10_000,
        unitPrice: 0.985,
        fee: 5,
        tax: 0,
      }),
    ).toBe(9_855);
  });

  it("prices an opt-in percent-of-par bond via its explicit multiplier", () => {
    // Same economics entered as percent (98.5) with contractMultiplier 0.01.
    expect(
      calculateTradeFinalAmount({
        activityType: ActivityType.BUY,
        instrumentType: "BOND",
        quantity: 10_000,
        unitPrice: 98.5,
        fee: 5,
        tax: 0,
        contractMultiplier: 0.01,
      }),
    ).toBe(9_855);
  });
});

describe("calculateTradeFinalCash direction", () => {
  it("treats a sell whose charges exceed its proceeds as a debit", () => {
    expect(
      calculateTradeFinalCash({
        activityType: ActivityType.SELL,
        instrumentType: "OPTION",
        quantity: 1,
        unitPrice: 0.01,
        fee: 2,
        tax: 0,
        contractMultiplier: 100,
      }),
    ).toBe(-1);
  });
});
