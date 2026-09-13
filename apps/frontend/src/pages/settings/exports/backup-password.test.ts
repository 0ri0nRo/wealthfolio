import { afterEach, describe, expect, it, vi } from "vitest";
import { generateBackupPassphrase, isValidBackupPassword } from "./backup-password";
import words from "./eff-wordlist.json";

afterEach(() => vi.restoreAllMocks());
describe("backup passwords", () => {
  it("counts Unicode scalar characters, preserves spaces and bounds UTF-8 size", () => {
    expect(isValidBackupPassword("🦊".repeat(11))).toBe(false);
    expect(isValidBackupPassword("🦊".repeat(12))).toBe(true);
    expect(isValidBackupPassword("🦊".repeat(1024))).toBe(true);
    expect(isValidBackupPassword("a".repeat(1025))).toBe(false);
    expect(isValidBackupPassword("  twelve words ")).toBe(true);
  });
  it("rejects biased tail samples and has more than 80 bits of generated entropy", () => {
    expect(new Set(words).size).toBe(1296);
    expect(8 * Math.log2(words.length)).toBeGreaterThan(80);
    const samples = [65535, 0, 1295, 1296, 1, 2, 3, 4, 5];
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint16Array)[0] = samples.shift()!;
      return array;
    });
    expect(generateBackupPassphrase().split(" ")).toEqual([
      words[0],
      words[1295],
      words[0],
      ...words.slice(1, 6),
    ]);
    expect(samples).toHaveLength(0);
  });
});
