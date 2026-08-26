import { ActivityType } from "@/lib/constants";
import type { ActivityDetails } from "@/lib/types";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActivityForm } from "./activity-form";
import type { AccountSelectOption } from "./forms/fields";

vi.mock("@wealthfolio/ui/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <>{children}</> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  SheetHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

// The picker and the forms have their own tests; what matters here is whether
// the picker is offered at all, and which type the renderer is asked for.
vi.mock("./activity-type-picker", () => ({
  ActivityTypePicker: ({
    value,
    onSelect,
    includeReclassificationTypes,
  }: {
    value?: string;
    onSelect: (type: string) => void;
    includeReclassificationTypes?: boolean;
  }) => (
    <div data-testid="type-picker" data-value={value ?? ""}>
      <button type="button" onClick={() => onSelect(ActivityType.DEPOSIT)}>
        pick deposit
      </button>
      {includeReclassificationTypes && (
        <>
          <button type="button" onClick={() => onSelect(ActivityType.CREDIT)}>
            pick credit
          </button>
          <button type="button" onClick={() => onSelect(ActivityType.ADJUSTMENT)}>
            pick adjustment
          </button>
        </>
      )}
    </div>
  ),
}));

vi.mock("./activity-form-renderer", () => ({
  ActivityFormRenderer: ({ selectedType }: { selectedType?: string }) => (
    <div data-testid="form-renderer">{selectedType ?? "no-type"}</div>
  ),
}));

vi.mock("../hooks/use-activity-form", () => ({
  useActivityForm: ({ activity }: { activity?: Partial<ActivityDetails> }) => ({
    defaultValues: undefined,
    isEditing: !!activity?.id,
    isLoading: false,
    error: null,
    isError: false,
    handleSubmit: vi.fn(),
  }),
}));

const accounts: AccountSelectOption[] = [
  { value: "acc_1", label: "Brokerage", currency: "USD" } as AccountSelectOption,
];

function activity(id: string, activityType: ActivityType): Partial<ActivityDetails> {
  return { id, activityType, accountId: "acc_1", currency: "USD" };
}

function renderForm(activityToEdit: Partial<ActivityDetails>) {
  return render(
    <ActivityForm accounts={accounts} open onClose={vi.fn()} activity={activityToEdit} />,
  );
}

function renderedType() {
  return screen.getByTestId("form-renderer").textContent;
}

describe("ActivityForm reclassification", () => {
  it("offers the type picker for a stored type that has no editor", () => {
    renderForm(activity("act_1", ActivityType.UNKNOWN));

    // The row is reported under the type it is stored as, alongside the picker.
    expect(screen.getByText(ActivityType.UNKNOWN)).toBeInTheDocument();
    expect(screen.getByTestId("type-picker")).toHaveAttribute("data-value", "");
    expect(renderedType()).toBe("no-type");
  });

  it("renders the picked type's form for the row being reclassified", async () => {
    const user = userEvent.setup();
    renderForm(activity("act_1", ActivityType.UNKNOWN));

    await user.click(screen.getByRole("button", { name: "pick deposit" }));

    expect(renderedType()).toBe(ActivityType.DEPOSIT);
  });

  it.each([
    [ActivityType.CREDIT, "pick credit"],
    [ActivityType.ADJUSTMENT, "pick adjustment"],
  ])("can reclassify UNKNOWN as %s", async (activityType, buttonName) => {
    const user = userEvent.setup();
    renderForm(activity("act_1", ActivityType.UNKNOWN));

    await user.click(screen.getByRole("button", { name: buttonName }));

    expect(renderedType()).toBe(activityType);
  });

  it.each([ActivityType.CREDIT, ActivityType.ADJUSTMENT])(
    "keeps a %s row on its own type instead of asking for a new one",
    (activityType) => {
      renderForm(activity("act_1", activityType));

      expect(screen.queryByTestId("type-picker")).not.toBeInTheDocument();
      expect(renderedType()).toBe(activityType);
    },
  );

  it("drops the picked type when a different activity is opened", async () => {
    const user = userEvent.setup();
    const { rerender } = renderForm(activity("act_1", ActivityType.UNKNOWN));

    await user.click(screen.getByRole("button", { name: "pick deposit" }));
    expect(renderedType()).toBe(ActivityType.DEPOSIT);

    rerender(
      <ActivityForm
        accounts={accounts}
        open
        onClose={vi.fn()}
        activity={activity("act_2", ActivityType.UNKNOWN)}
      />,
    );

    expect(screen.getByTestId("type-picker")).toHaveAttribute("data-value", "");
    expect(renderedType()).toBe("no-type");
  });
});
