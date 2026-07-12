import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AmountDisplay,
  FormattingProvider,
  useAmountFormatting,
  useDateFormatting,
  useLocalizationSettings,
  useNumberFormatting,
} from "@wealthfolio/ui";
import { type ReactElement, useState } from "react";
import { describe, expect, it, vi } from "vitest";

function LocaleSwitcher() {
  const [locale, setLocale] = useState("en-US");
  return (
    <FormattingProvider locale={locale} timezone="UTC">
      <AmountDisplay value={1234.56} currency="EUR" />
      <button type="button" onClick={() => setLocale("fr-FR")}>
        {locale}
      </button>
    </FormattingProvider>
  );
}

function FormattingConsumer() {
  ({
    ...useLocalizationSettings(),
    ...useAmountFormatting(),
    ...useNumberFormatting(),
    ...useDateFormatting(),
  });
  return null;
}

function AmountFormattingConsumer() {
  useAmountFormatting();
  return null;
}

const observedAmountServices: unknown[] = [];
function AmountServiceConsumer() {
  observedAmountServices.push(useAmountFormatting());
  return null;
}

const observedServices: Array<{ amount: unknown; number: unknown; date: unknown }> = [];
function ServiceIdentityConsumer() {
  observedServices.push({
    amount: useAmountFormatting(),
    number: useNumberFormatting(),
    date: useDateFormatting(),
  });
  return null;
}

function RegionalNumber() {
  return <span>{useNumberFormatting().formatDecimal(1234.56)}</span>;
}

describe("FormattingProvider", () => {
  it("reactively updates presentation without a reload", async () => {
    const { user } = setupUser(<LocaleSwitcher />);
    expect(screen.getByText("€1,234.56")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "en-US" }));

    expect(screen.getByText(/^1[\u00a0\u202f ]234,56\s*€$/)).toBeInTheDocument();
  });

  it("preserves finance privacy masking", () => {
    render(
      <FormattingProvider locale="en-US">
        <AmountDisplay value={1234.56} currency="USD" isHidden />
      </FormattingProvider>,
    );
    expect(screen.getByText("••••")).toBeInTheDocument();
  });

  it("keeps UI language separate from regional number conventions", () => {
    render(
      <FormattingProvider locale="DE" uiLocale="en">
        <RegionalNumber />
      </FormattingProvider>,
    );
    expect(screen.getByText("1.234,56")).toBeInTheDocument();
  });

  it("reuses the provider-owned finance service across consumers", () => {
    observedAmountServices.length = 0;
    render(
      <FormattingProvider locale="US" uiLocale="en">
        <AmountServiceConsumer />
        <AmountServiceConsumer />
      </FormattingProvider>,
    );
    expect(observedAmountServices).toHaveLength(2);
    expect(observedAmountServices[0]).toBe(observedAmountServices[1]);
  });

  it("keeps amount and number services stable across timezone-only updates", () => {
    observedServices.length = 0;
    const { rerender } = render(
      <FormattingProvider locale="US" uiLocale="en" timezone="UTC">
        <ServiceIdentityConsumer />
      </FormattingProvider>,
    );
    const initial = observedServices.at(-1)!;

    rerender(
      <FormattingProvider locale="US" uiLocale="en" timezone="America/Toronto">
        <ServiceIdentityConsumer />
      </FormattingProvider>,
    );
    const updated = observedServices.at(-1)!;

    expect(updated.amount).toBe(initial.amount);
    expect(updated.number).toBe(initial.number);
    expect(updated.date).not.toBe(initial.date);
  });

  it("throws clearly when the required provider is missing", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<FormattingConsumer />)).toThrow(
      "useLocalizationSettings must be used within a FormattingProvider",
    );
    expect(() => render(<AmountFormattingConsumer />)).toThrow(
      "useAmountFormatting must be used within a FormattingProvider",
    );
    consoleError.mockRestore();
  });
});

function setupUser(element: ReactElement) {
  return {
    ...render(element),
    user: userEvent.setup(),
  };
}
