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
    const prohibitedTerms = ["賬", "轉賬", "對映", "添加", "創建", "自定義", "數據", "默認", "獲取", "當前", "此處", "點選", "重置", "模板", "響應", "退出登入", "儀表盤", "未找到", "程式碼", "通過", "返佣", "佣金", "占比", "周期", "周", "余額", "校驗", "跟蹤", "通脹", "供款", "收益率", "構建", "對比"];

    for (const translation of Object.values(traditionalChinese)) {
      for (const value of flatten(translation).values()) {
        for (const term of prohibitedTerms) expect(value).not.toContain(term);
        expect(value).not.toBe("應用");
      }
    }
  });
});
