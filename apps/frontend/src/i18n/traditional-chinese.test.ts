import { describe, expect, it } from "vitest";
import { NAMESPACES } from "./locales";

type Translation = string | { [key: string]: Translation };

const english = import.meta.glob<Translation>("./locales/en/*.json", {
  eager: true,
  import: "default",
});
const traditionalChinese = import.meta.glob<Translation>("./locales/zh-TW/*.json", {
  eager: true,
  import: "default",
});

function flatten(value: Translation, prefix = ""): Map<string, string> {
  if (typeof value === "string") return new Map([[prefix, value]]);

  return new Map(
    Object.entries(value).flatMap(([key, nested]) =>
      [...flatten(nested, prefix ? `${prefix}.${key}` : key).entries()],
    ),
  );
}

function interpolations(value: string) {
  return [...value.matchAll(/{{[^}]+}}/g)].map((match) => match[0]).sort();
}

describe("Traditional Chinese translations", () => {
  it("matches every English namespace, key, and interpolation", () => {
    expect(Object.keys(traditionalChinese)).toHaveLength(NAMESPACES.length);

    for (const namespace of NAMESPACES) {
      const englishFile = flatten(english[`./locales/en/${namespace}.json`]);
      const traditionalChineseFile = flatten(
        traditionalChinese[`./locales/zh-TW/${namespace}.json`],
      );

      expect([...traditionalChineseFile.keys()].sort()).toEqual([...englishFile.keys()].sort());

      for (const [key, source] of englishFile) {
        expect(interpolations(traditionalChineseFile.get(key) ?? "")).toEqual(interpolations(source));
      }
    }
  });

  it("uses Taiwan terminology instead of Mainland Chinese variants", () => {
    const prohibitedTerms = ["賬", "轉賬", "對映", "添加", "創建", "自定義", "數據", "默認", "獲取", "當前", "此處", "點選", "重置", "模板", "響應", "退出登入", "儀表盤", "未找到", "程式碼", "通過", "返佣", "佣金", "占比", "周期", "周", "余額", "校驗", "跟蹤", "通脹", "供款", "收益率", "構建", "對比", "常規", "高階", "提供商", "期權", "倉位", "情景"];

    for (const translation of Object.values(traditionalChinese)) {
      for (const value of flatten(translation).values()) {
        for (const term of prohibitedTerms) expect(value).not.toContain(term);
        expect(value).not.toBe("應用");
      }
    }
  });

  it("uses the correct stock-split direction in the help text", () => {
    const activity = flatten(traditionalChinese["./locales/zh-TW/activity.json"]);

    expect(activity.get("type_split_desc")).toContain("1 拆 2");
  });

  it("keeps nominal values distinct from inflation-adjusted values", () => {
    const goals = flatten(traditionalChinese["./locales/zh-TW/goals.json"]);

    expect(goals.get("dashboard.value_mode.nominal_tip")).toContain("包含通膨影響");
  });

  it("does not duplicate the client configuration dialog prefix", () => {
    const settings = flatten(traditionalChinese["./locales/zh-TW/settings.json"]);

    expect(settings.get("agentAccess.dialog_client_config_desc")).toMatch(/^可直接貼上/);
  });
});
