import { describe, expect, it } from "vitest";
import { ActivityType } from "@/lib/constants";
import { mapActivityTypeToPicker } from "../utils/activity-form-utils";
import { hasActivityForm } from "./activity-form-config";

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

  it("rejects stored types that have no editor", () => {
    // These are persisted types with no form. A needs-review row imported by
    // sync arrives as UNKNOWN, which is exactly the row a user has to
    // reclassify — so the caller must offer the picker rather than pin it.
    expect(hasActivityForm("UNKNOWN")).toBe(false);
    expect(hasActivityForm("CREDIT")).toBe(false);
    expect(hasActivityForm("ADJUSTMENT")).toBe(false);
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
