import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETIREMENT_PLAN,
  normalizeDashboardRetirementPlan,
  parseSettingsJson,
  scaleRetirementPlanAmounts,
} from "./plan-adapter";

describe("retirement plan adapter", () => {
  it("default plans do not include legacy withdrawal-rule fields", () => {
    const plan = parseSettingsJson("{}");

    expect(plan).not.toHaveProperty("withdrawal");
  });

  it("parses old withdrawal-rule JSON and strips it from the normalized plan", () => {
    const plan = parseSettingsJson(
      JSON.stringify({
        withdrawal: {
          safeWithdrawalRate: 0.04,
          strategy: "guardrails",
          guardrails: {
            ceilingRate: 0.06,
          },
        },
      }),
    );

    expect(plan).not.toHaveProperty("withdrawal");
  });

  it("saving a plan strips any legacy withdrawal-rule fields", () => {
    const plan = parseSettingsJson(
      JSON.stringify({
        withdrawal: {
          safeWithdrawalRate: 0.041,
          strategy: "constant-percentage",
        },
      }),
    );

    const normalized = normalizeDashboardRetirementPlan(plan);

    expect(normalized).not.toHaveProperty("withdrawal");
  });
});

describe("scaleRetirementPlanAmounts", () => {
  it("scales monthly contribution and expense items by the given rate", () => {
    const scaled = scaleRetirementPlanAmounts(DEFAULT_RETIREMENT_PLAN, 15000);

    expect(scaled.investment.monthlyContribution).toBe(
      DEFAULT_RETIREMENT_PLAN.investment.monthlyContribution * 15000,
    );
    expect(scaled.expenses.items.map((item) => item.monthlyAmount)).toEqual(
      DEFAULT_RETIREMENT_PLAN.expenses.items.map((item) => item.monthlyAmount * 15000),
    );
  });

  it("rounds scaled amounts to the nearest whole number", () => {
    const plan = {
      ...DEFAULT_RETIREMENT_PLAN,
      investment: { ...DEFAULT_RETIREMENT_PLAN.investment, monthlyContribution: 3 },
      expenses: { items: [{ id: "living", label: "Living", monthlyAmount: 3, essential: true }] },
    };

    const scaled = scaleRetirementPlanAmounts(plan, 1.5);

    expect(scaled.investment.monthlyContribution).toBe(5);
    expect(scaled.expenses.items[0].monthlyAmount).toBe(5);
  });

  it("leaves non-monetary fields and the original plan untouched", () => {
    const scaled = scaleRetirementPlanAmounts(DEFAULT_RETIREMENT_PLAN, 15000);

    expect(scaled.personal).toEqual(DEFAULT_RETIREMENT_PLAN.personal);
    expect(scaled.investment.preRetirementAnnualReturn).toBe(
      DEFAULT_RETIREMENT_PLAN.investment.preRetirementAnnualReturn,
    );
    expect(scaled.expenses.items[0].label).toBe(DEFAULT_RETIREMENT_PLAN.expenses.items[0].label);
    expect(DEFAULT_RETIREMENT_PLAN.investment.monthlyContribution).toBe(1000);
  });
});
