import { de, enCA, enGB, enUS, es, fr, frCA, ja, ko, zhCN, type Locale } from "date-fns/locale";
import { useLocalizationSettings } from "../components/formatting-provider";

const DATE_FNS_LOCALES: Record<string, Locale> = {
  "en-CA": enCA,
  "en-US": enUS,
  "en-GB": enGB,
  "fr-CA": frCA,
  "fr-FR": fr,
  "de-DE": de,
  "es-ES": es,
  "es-MX": es,
  "zh-CN": zhCN,
  "ja-JP": ja,
  "ko-KR": ko,
};

const LANGUAGE_LOCALES: Record<string, Locale> = {
  en: enUS,
  fr,
  de,
  es,
  zh: zhCN,
  ja,
  ko,
};

const REGION_LOCALES: Record<string, Locale> = {
  CA: enCA,
  US: enUS,
  GB: enGB,
  FR: fr,
  DE: de,
  ES: es,
  MX: es,
  CN: zhCN,
  JP: ja,
  KR: ko,
};

export function dateFnsLocaleFor(locale: string | undefined): Locale {
  if (!locale) throw new Error("A resolved formatting locale is required for date-fns");
  const exact = DATE_FNS_LOCALES[locale];
  if (exact) return exact;

  const resolved = new Intl.Locale(locale);
  const languageLocale = LANGUAGE_LOCALES[resolved.language];
  if (!languageLocale)
    throw new Error(`Unsupported UI language for date-fns: ${resolved.language}`);
  const regionLocale = resolved.region ? REGION_LOCALES[resolved.region] : undefined;
  if (!regionLocale?.options) return languageLocale;

  // date-fns owns calendar text while the selected region owns week conventions.
  return { ...languageLocale, code: locale, options: regionLocale.options };
}

export function useDateFnsLocale(): Locale {
  return dateFnsLocaleFor(useLocalizationSettings().locale);
}
