import { useSettings } from "@/hooks/use-settings";
import { ActivityType } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@wealthfolio/ui/components/ui/button";
import { Icons } from "@wealthfolio/ui/components/ui/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import type { TFunction } from "i18next";
import {
  AccountSelect,
  AdvancedOptionsSection,
  createValidatedSubmit,
  DatePicker,
  FormSection,
  NotesInput,
  QuantityInput,
  SymbolSearch,
  type AccountSelectOption,
} from "./fields";

// Translated message helper (see buy-form for rationale).
type MsgFn = TFunction | undefined;
const msg = (t: MsgFn, key: string, en: string) => (t ? t(key) : en);

// Zod schema factory for AdjustmentForm validation. `t` optional so the exported
// static schema keeps English messages (used by tests and type inference).
export const createAdjustmentFormSchema = (t?: TFunction) =>
  z.object({
    accountId: z
      .string()
      .min(1, { message: msg(t, "activity:form.err_select_account", "Please select an account.") }),
    symbol: z
      .string()
      .min(1, { message: msg(t, "activity:form.err_enter_symbol", "Please enter a symbol.") }),
    existingAssetId: z.string().nullable().optional(),
    exchangeMic: z.string().nullable().optional(),
    activityDate: z.date({
      required_error: msg(t, "activity:form.err_select_date", "Please select a date."),
    }),
    quantity: z.coerce
      .number({
        required_error: msg(t, "activity:form.err_enter_quantity", "Please enter a quantity."),
        invalid_type_error: msg(
          t,
          "activity:form.err_quantity_number",
          "Quantity must be a number.",
        ),
      })
      .positive({
        message: msg(t, "activity:form.err_quantity_gt_zero", "Quantity must be greater than 0."),
      }),
    comment: z.string().optional().nullable(),
    // Advanced options
    currency: z
      .string()
      .min(1, { message: msg(t, "activity:form.err_currency_required", "Currency is required.") }),
    subtype: z.string().optional().nullable(),
    symbolQuoteCcy: z.string().nullable().optional(),
    symbolInstrumentType: z.string().nullable().optional(),
  });

// Zod schema for AdjustmentForm validation (English messages; used by tests).
export const adjustmentFormSchema = createAdjustmentFormSchema();

export type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

interface AdjustmentFormProps {
  accounts: AccountSelectOption[];
  defaultValues?: Partial<AdjustmentFormValues>;
  onSubmit: (data: AdjustmentFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  isEditing?: boolean;
  /** Whether to show manual symbol input instead of search */
  isManualSymbol?: boolean;
  /** Asset currency (from selected symbol) for advanced options */
  assetCurrency?: string;
}

/**
 * Editor for an ADJUSTMENT activity — a non-trade quantity correction against a
 * holding (option expiry today). Mirrors the field set the mobile flow already
 * offers for this type, and carries the subtype through so an OPTION_EXPIRY row
 * keeps behaving like one after an edit.
 */
export function AdjustmentForm({
  accounts,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
  isManualSymbol = false,
  assetCurrency,
}: AdjustmentFormProps) {
  const { t } = useTranslation(["activity"]);
  const { data: settings } = useSettings();
  const baseCurrency = settings?.baseCurrency;

  const schema = useMemo(() => createAdjustmentFormSchema(t), [t]);

  // Compute initial account and currency for defaultValues
  const initialAccountId =
    defaultValues?.accountId ?? (accounts.length === 1 ? accounts[0].value : "");
  const initialAccount = accounts.find((a) => a.value === initialAccountId);
  const initialCurrency =
    defaultValues?.currency?.trim() || assetCurrency?.trim() || initialAccount?.currency;

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(schema) as Resolver<AdjustmentFormValues>,
    mode: "onSubmit", // Validate only on submit - works correctly with default values
    defaultValues: {
      accountId: initialAccountId,
      symbol: "",
      activityDate: new Date(),
      quantity: undefined,
      comment: null,
      subtype: null,
      ...defaultValues,
      currency: defaultValues?.currency?.trim() || initialCurrency,
    },
  });

  const { watch } = form;
  const accountId = watch("accountId");

  // Get account currency from selected account
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.value === accountId),
    [accounts, accountId],
  );
  const accountCurrency = selectedAccount?.currency;

  const handleSubmit = createValidatedSubmit(form, async (data) => {
    await onSubmit(data);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection title={t("activity:form.section_asset_account")}>
          <SymbolSearch
            name="symbol"
            label={t("activity:form.label_symbol")}
            isManualAsset={isManualSymbol}
            exchangeMicName="exchangeMic"
            currencyName="currency"
            quoteCcyName="symbolQuoteCcy"
            instrumentTypeName="symbolInstrumentType"
            existingAssetIdName="existingAssetId"
          />
          <input type="hidden" {...form.register("symbolQuoteCcy")} />
          <input type="hidden" {...form.register("symbolInstrumentType")} />
          <input type="hidden" {...form.register("existingAssetId")} />

          <AccountSelect name="accountId" accounts={accounts} currencyName="currency" />
          <DatePicker name="activityDate" label={t("activity:field_date")} />
        </FormSection>

        <FormSection title={t("activity:type_adjustment")}>
          <QuantityInput name="quantity" label={t("activity:form.label_quantity")} />
        </FormSection>

        {/* Advanced options (currency, subtype) and notes, collapsed by default */}
        <AdvancedOptionsSection
          title={t("activity:form.section_advanced_notes")}
          dashed
          currencyName="currency"
          subtypeName="subtype"
          activityType={ActivityType.ADJUSTMENT}
          assetCurrency={assetCurrency}
          accountCurrency={accountCurrency}
          baseCurrency={baseCurrency}
        >
          <NotesInput
            name="comment"
            label={t("activity:form.label_notes")}
            placeholder={t("activity:form.placeholder_note")}
          />
        </AdvancedOptionsSection>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              {t("activity:cancel")}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? (
              <Icons.Check className="mr-2 h-4 w-4" />
            ) : (
              <Icons.Plus className="mr-2 h-4 w-4" />
            )}
            {isEditing
              ? t("activity:form.button_update")
              : t("activity:form.button_add_prefixed", { action: t("activity:type_adjustment") })}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
