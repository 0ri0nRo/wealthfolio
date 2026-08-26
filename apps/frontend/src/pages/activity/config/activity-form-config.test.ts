import { describe, expect, it } from "vitest";
import { ActivityType } from "@/lib/constants";
import { mapActivityTypeToPicker } from "../utils/activity-form-utils";
import type { AdjustmentFormValues } from "../components/forms/adjustment-form";
import { ACTIVITY_FORM_CONFIG, hasActivityForm } from "./activity-form-config";

describe("hasActivityForm", () => {
  it("accepts every type the picker can offer", () => {
    for (const pickerType of [
      ActivityType.BUY,
      ActivityType.SELL,
      ActivityType.DEPOSIT,
      ActivityType.WITHDRAWAL,
      ActivityType.DIVIDEND,
      "TRANSFER",
      ActivityType.SPLIT,
      ActivityType.FEE,
      ActivityType.INTEREST,
      ActivityType.TAX,
    ]) {
      expect(hasActivityForm(pickerType)).toBe(true);
    }
  });

  it("accepts stored types that are hidden from ordinary creation", () => {
    // CREDIT and ADJUSTMENT remain editable and are offered as reclassification
    // targets even though ordinary creation does not expose them.
    expect(hasActivityForm(ActivityType.CREDIT)).toBe(true);
    expect(hasActivityForm(ActivityType.ADJUSTMENT)).toBe(true);
  });

  it("rejects a stored type that has no editor", () => {
    // A needs-review row imported by sync arrives as UNKNOWN, which carries no
    // classification and so has nothing to edit — the caller must offer the
    // picker rather than pin it.
    expect(hasActivityForm(ActivityType.UNKNOWN)).toBe(false);
  });

  it("rejects an absent type", () => {
    expect(hasActivityForm(undefined)).toBe(false);
    expect(hasActivityForm("")).toBe(false);
  });

  it("agrees with the picker mapping for both transfer legs", () => {
    // TRANSFER_IN/OUT are stored types with no form of their own; the picker
    // alias is what has one, so the two helpers have to be used together.
    expect(hasActivityForm(ActivityType.TRANSFER_IN)).toBe(false);
    expect(hasActivityForm(mapActivityTypeToPicker(ActivityType.TRANSFER_IN))).toBe(true);
    expect(hasActivityForm(mapActivityTypeToPicker(ActivityType.TRANSFER_OUT))).toBe(true);
  });
});

describe("ADJUSTMENT form config", () => {
  it("preserves the amount for a cash adjustment without an asset", () => {
    const defaults = ACTIVITY_FORM_CONFIG.ADJUSTMENT.getDefaults(
      {
        activityType: ActivityType.ADJUSTMENT,
        accountId: "acc-1",
        amount: "25",
        currency: "USD",
      },
      [],
    );

    expect(defaults).toMatchObject({ symbol: "", amount: 25, currency: "USD" });

    const payload = ACTIVITY_FORM_CONFIG.ADJUSTMENT.toPayload({
      accountId: "acc-1",
      activityDate: new Date("2026-01-15T00:00:00Z"),
      amount: 25,
      currency: "USD",
    } satisfies AdjustmentFormValues);

    expect(payload).toMatchObject({ assetId: undefined, quantity: null, amount: 25 });
  });
});
