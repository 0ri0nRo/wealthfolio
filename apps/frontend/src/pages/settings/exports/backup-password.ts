import words from "./eff-wordlist.json";

export function isValidBackupPassword(password: string): boolean {
  const length = Array.from(password).length;
  return length >= 12 && length <= 1024 && new TextEncoder().encode(password).length <= 4096;
}

/** Eight independent uniform selections: 8 * log2(1296) ≈ 82.7 bits. */
export function generateBackupPassphrase(): string {
  const limit = Math.floor(65536 / words.length) * words.length;
  const random = new Uint16Array(1);
  return Array.from({ length: 8 }, () => {
    do {
      crypto.getRandomValues(random);
    } while (random[0] >= limit);
    return words[random[0] % words.length];
  }).join(" ");
}
