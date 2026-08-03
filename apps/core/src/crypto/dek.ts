/** Envelope encryption — DEK management (stub for Phase 2 DPDP). */
export async function deriveDek(_masterSecret: string, _userId: string): Promise<CryptoKey> {
  throw new Error("DEK derivation not implemented yet");
}
