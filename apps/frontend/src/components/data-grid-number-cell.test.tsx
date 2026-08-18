import { fireEvent, render, screen } from "@testing-library/react";
import { FormattingProvider } from "@wealthfolio/ui";
import { NumberCell } from "@wealthfolio/ui/components/data-grid/data-grid-cell-variants";
import type { Cell, TableMeta } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

interface TestRow {
  value: number;
}

function renderCell(onDataUpdate = vi.fn()) {
  const cell = {
    getValue: () => 1234.56,
    column: { columnDef: { meta: { cell: { variant: "number" } } } },
    row: { original: { value: 1234.56 } },
  } as unknown as Cell<TestRow, unknown>;
  const tableMeta: TableMeta<TestRow> = { onDataUpdate };

  render(
    <FormattingProvider locale="de-DE">
      <NumberCell
        cell={cell}
        tableMeta={tableMeta}
        rowIndex={0}
        columnId="value"
        rowHeight="short"
        isEditing
        isFocused
        isSelected={false}
        isSearchMatch={false}
        isActiveSearchMatch={false}
        readOnly={false}
      />
    </FormattingProvider>,
  );

  return { onDataUpdate };
}

describe("NumberCell localized editing", () => {
  it("does not erase an untouched machine-format value", () => {
    const { onDataUpdate } = renderCell();

    fireEvent.blur(screen.getByRole("textbox"));

    expect(onDataUpdate).not.toHaveBeenCalled();
  });

  it("commits localized decimal input", () => {
    const { onDataUpdate } = renderCell();
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "1234,75" } });
    fireEvent.blur(input);

    expect(onDataUpdate).toHaveBeenCalledWith({ rowIndex: 0, columnId: "value", value: 1234.75 });
  });

  it("preserves the original value when non-empty input is invalid", () => {
    const { onDataUpdate } = renderCell();
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.blur(input);

    expect(onDataUpdate).not.toHaveBeenCalled();
    expect(input).toHaveValue("1234.56");
  });
});
