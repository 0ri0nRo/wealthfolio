import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormattingProvider, MoneyInput, QuantityInput } from "@wealthfolio/ui";
import { describe, expect, it, vi } from "vitest";

function paste(text: string) {
  return fireEvent.paste(screen.getByRole("textbox"), {
    clipboardData: { getData: () => text },
  });
}

describe("localized financial input paste", () => {
  it.each([
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["$1,234.56", 1234.56],
    ["USD 1,234.56", 1234.56],
  ])("pastes %s using US formats", (clipboardValue, expected) => {
    const onValueChange = vi.fn();
    render(
      <FormattingProvider locale="en-US">
        <MoneyInput onValueChange={onValueChange} />
      </FormattingProvider>,
    );

    paste(clipboardValue);

    expect(onValueChange).toHaveBeenLastCalledWith(expected);
  });

  it.each([
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1.234,56 €", 1234.56],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
  ])("pastes %s using German formats", (clipboardValue, expected) => {
    const onValueChange = vi.fn();
    render(
      <FormattingProvider locale="de-DE">
        <MoneyInput onValueChange={onValueChange} />
      </FormattingProvider>,
    );

    paste(clipboardValue);

    expect(onValueChange).toHaveBeenLastCalledWith(expected);
  });

  it.each([
    ["1.234,56", "money"],
    ["-100", "money"],
    ["1.234,56", "quantity"],
    ["-100", "quantity"],
  ] as const)(
    "blocks rejected %s full-value pastes in %s inputs",
    async (clipboardValue, inputKind) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <FormattingProvider locale="en-US">
          {inputKind === "money" ? (
            <MoneyInput onValueChange={onValueChange} />
          ) : (
            <QuantityInput onValueChange={onValueChange} />
          )}
        </FormattingProvider>,
      );
      const input = screen.getByRole<HTMLInputElement>("textbox");

      await user.click(input);
      await user.paste(clipboardValue);

      expect(input).toHaveValue("");
      expect(onValueChange).not.toHaveBeenCalled();
    },
  );

  it("uses the same locale-aware paste behavior for quantities", () => {
    const onValueChange = vi.fn();
    render(
      <FormattingProvider locale="de-DE">
        <QuantityInput onValueChange={onValueChange} />
      </FormattingProvider>,
    );

    paste("1.234,56");

    expect(onValueChange).toHaveBeenLastCalledWith(1234.56);
  });

  it("pastes invariant decimals into German quantities", () => {
    const onValueChange = vi.fn();
    render(
      <FormattingProvider locale="de-DE">
        <QuantityInput onValueChange={onValueChange} />
      </FormattingProvider>,
    );

    paste("1234.56");

    expect(onValueChange).toHaveBeenLastCalledWith(1234.56);
  });

  it("normalizes full-width CJK numeric input", () => {
    const onValueChange = vi.fn();
    render(
      <FormattingProvider locale="ja-JP">
        <MoneyInput onValueChange={onValueChange} />
      </FormattingProvider>,
    );

    paste("￥１，２３４．５６");

    expect(onValueChange).toHaveBeenLastCalledWith(1234.56);
  });

  it.each([
    ["fr-FR", "1\u202f234,56\u00a0$US"],
    ["ja-JP", "元\u00a01,234.56"],
  ])("pastes localized currency output for %s", (locale, clipboardValue) => {
    const onValueChange = vi.fn();
    render(
      <FormattingProvider locale={locale}>
        <MoneyInput onValueChange={onValueChange} />
      </FormattingProvider>,
    );

    paste(clipboardValue);

    expect(onValueChange).toHaveBeenLastCalledWith(1234.56);
  });

  it("leaves partial plain-number pastes to the input", () => {
    const onValueChange = vi.fn();
    render(
      <FormattingProvider locale="en-US">
        <MoneyInput value={100} onValueChange={onValueChange} />
      </FormattingProvider>,
    );
    const input = screen.getByRole<HTMLInputElement>("textbox");
    input.setSelectionRange(1, 2);

    const allowed = fireEvent.paste(input, {
      clipboardData: { getData: () => "5" },
    });

    expect(allowed).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
