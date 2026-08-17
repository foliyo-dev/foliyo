/** Whitespace-collapsed lowercase — must match core `hashJdText`. */
export function normalizeJdText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function hashJdText(text: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeJdText(text));
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}