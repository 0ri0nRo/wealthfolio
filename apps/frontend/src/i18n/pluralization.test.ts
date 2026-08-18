import deActivity from "./locales/de/activity.json";
import enActivity from "./locales/en/activity.json";
import esActivity from "./locales/es/activity.json";
import frActivity from "./locales/fr/activity.json";
import i18next from "i18next";
import { describe, expect, it } from "vitest";

const resources = {
  de: { activity: deActivity },
  en: { activity: enActivity },
  es: { activity: esActivity },
  fr: { activity: frActivity },
};

describe("singular translations", () => {
  it.each([
    ["en", "There are issues with 1 activity entry."],
    ["fr", "Il y a des problèmes avec 1 entrée d'activité."],
    ["de", "Es gibt Probleme mit 1 Aktivitätseintrag."],
    ["es", "Hay problemas con 1 entrada de actividad."],
  ])("uses the singular activity form for %s", async (locale, expected) => {
    const i18n = i18next.createInstance();
    await i18n.init({
      defaultNS: "activity",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      lng: locale,
      ns: ["activity"],
      resources,
    });

    expect(i18n.t("activity:import.validationAlert.issuesTitle", { count: 1 })).toBe(expected);
  });
});
