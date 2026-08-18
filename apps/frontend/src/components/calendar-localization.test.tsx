import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Calendar,
  DatePickerInput,
  FormattingProvider,
  MonthYearPicker,
} from "@wealthfolio/ui";
import { describe, expect, it, vi } from "vitest";

describe("calendar localization policy", () => {
  it("formats month choices with the formatting locale", () => {
    render(
      <FormattingProvider locale="ja-JP" uiLocale="en">
        <MonthYearPicker value="2026-01" maxDate="2026-12" />
      </FormattingProvider>,
    );

    expect(screen.getByRole("button", { name: "1月" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jan" })).not.toBeInTheDocument();
  });

  it("uses UI-language labels for DayPicker controls", () => {
    render(
      <FormattingProvider locale="de-DE" uiLocale="en">
        <Calendar defaultMonth={new Date(2026, 7, 1)} />
      </FormattingProvider>,
    );

    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
  });

  it("uses UI-language labels for React Aria calendar controls", async () => {
    const user = userEvent.setup();
    render(
      <FormattingProvider locale="de-DE" uiLocale="en">
        <DatePickerInput value="2026-08-18" onChange={vi.fn()} />
      </FormattingProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Pick a date/ }));

    expect(await screen.findByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
  });
});
