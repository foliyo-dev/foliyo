export async function encrypt(plaintext: string, dek: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dek, encoded);
  const combined = new Uint8Array([...iv, ...new Uint8Array(ct)]);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encoded: string, dek: CryptoKey): Promise<string> {
  const combined = new Uint8Array(atob(encoded).split("").map((c) => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, dek, ct);
  return new TextDecoder().decode(plain);
}
