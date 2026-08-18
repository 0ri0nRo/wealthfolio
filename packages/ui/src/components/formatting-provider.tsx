import * as React from "react";
import { I18nProvider, useDateFormatter, useNumberFormatter } from "@react-aria/i18n";
import {
  createAmountFormatting,
  createDateFormatting,
  createNumberFormatting,
  type AmountFormatting,
  type DateFormatting,
  type NumberFormatting,
  resolveFormattingLocale,
} from "../lib/formatting";

export interface LocalizationSettings {
  locale: string;
  uiLocale: string;
  timezone?: string;
}

const DEFAULT_LOCALIZATION_SETTINGS: LocalizationSettings = { locale: "en-US", uiLocale: "en" };
const DEFAULT_AMOUNT_FORMATTING = createAmountFormatting(DEFAULT_LOCALIZATION_SETTINGS.locale);
const DEFAULT_NUMBER_FORMATTING = createNumberFormatting(DEFAULT_LOCALIZATION_SETTINGS.locale);
const DEFAULT_DATE_FORMATTING = createDateFormatting(DEFAULT_LOCALIZATION_SETTINGS.locale);

const LocalizationSettingsContext = React.createContext(DEFAULT_LOCALIZATION_SETTINGS);
const AmountFormattingContext = React.createContext(DEFAULT_AMOUNT_FORMATTING);
const NumberFormattingContext = React.createContext(DEFAULT_NUMBER_FORMATTING);
const DateFormattingContext = React.createContext(DEFAULT_DATE_FORMATTING);

const DECIMAL_FORMAT_OPTIONS: Intl.NumberFormatOptions = {};
const AMOUNT_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};
const QUANTITY_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  maximumFractionDigits: 8,
  useGrouping: true,
};

function FormattingRuntime({ settings, children }: { settings: LocalizationSettings; children: React.ReactNode }) {
  const decimal = useNumberFormatter(DECIMAL_FORMAT_OPTIONS);
  const amount = useNumberFormatter(AMOUNT_FORMAT_OPTIONS);
  const quantity = useNumberFormatter(QUANTITY_FORMAT_OPTIONS);
  const date = useDateFormatter({
    dateStyle: "medium",
    ...(settings.timezone ? { timeZone: settings.timezone } : {}),
  });
  const calendarDate = useDateFormatter({ dateStyle: "medium", timeZone: "UTC" });
  const calendarDateTime = useDateFormatter({
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const timeOfDay = useDateFormatter({ timeStyle: "short", timeZone: "UTC" });
  const time = useDateFormatter({
    timeStyle: "short",
    ...(settings.timezone ? { timeZone: settings.timezone } : {}),
  });
  const dateTime = useDateFormatter({
    dateStyle: "medium",
    timeStyle: "short",
    ...(settings.timezone ? { timeZone: settings.timezone } : {}),
  });

  const amountFormatting = React.useMemo<AmountFormatting>(
    () => createAmountFormatting(settings.locale, { decimal, amount }),
    [settings.locale, decimal, amount],
  );
  const numberFormatting = React.useMemo<NumberFormatting>(
    () => createNumberFormatting(settings.locale, { decimal, quantity }),
    [settings.locale, decimal, quantity],
  );
  const dateFormatting = React.useMemo<DateFormatting>(
    () =>
      createDateFormatting(settings.locale, settings.timezone, {
        date,
        calendarDate,
        calendarDateTime,
        timeOfDay,
        time,
        dateTime,
      }),
    [settings.locale, settings.timezone, date, calendarDate, calendarDateTime, timeOfDay, time, dateTime],
  );

  return (
    <AmountFormattingContext.Provider value={amountFormatting}>
      <NumberFormattingContext.Provider value={numberFormatting}>
        <DateFormattingContext.Provider value={dateFormatting}>{children}</DateFormattingContext.Provider>
      </NumberFormattingContext.Provider>
    </AmountFormattingContext.Provider>
  );
}

export function FormattingProvider({
  locale,
  uiLocale = "en",
  timezone,
  children,
}: {
  locale: string;
  uiLocale?: string;
  timezone?: string;
  children: React.ReactNode;
}) {
  const resolvedLocale = resolveFormattingLocale(locale);
  const settings = React.useMemo(
    () => ({ locale: resolvedLocale, uiLocale, timezone }),
    [resolvedLocale, uiLocale, timezone],
  );
  return (
    <I18nProvider locale={resolvedLocale}>
      <LocalizationSettingsContext.Provider value={settings}>
        <FormattingRuntime settings={settings}>{children}</FormattingRuntime>
      </LocalizationSettingsContext.Provider>
    </I18nProvider>
  );
}

export function useLocalizationSettings(): LocalizationSettings {
  return React.useContext(LocalizationSettingsContext);
}

export function useAmountFormatting(): AmountFormatting {
  return React.useContext(AmountFormattingContext);
}

export function useNumberFormatting(): NumberFormatting {
  return React.useContext(NumberFormattingContext);
}

export function useDateFormatting(): DateFormatting {
  return React.useContext(DateFormattingContext);
}
