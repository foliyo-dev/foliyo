import { createHash } from "node:crypto";

/** SHA-256 hex of a bearer / email / reset secret. Store this; never store the raw token. */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
