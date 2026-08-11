export type ExtSettings = {
  apiBase: string;
  token: string | null;
  email: string | null;
};

const DEFAULTS: ExtSettings = {
  apiBase: "http://localhost:8080",
  token: null,
  email: null,
};

export async function loadSettings(): Promise<ExtSettings> {
  const stored = await chrome.storage.local.get(["apiBase", "token", "email"]);
  const token = typeof stored.token === "string" && stored.token.length > 0 ? stored.token : null;
  const email = typeof stored.email === "string" && stored.email.length > 0 ? stored.email : null;
  return {
    apiBase: (typeof stored.apiBase === "string" && stored.apiBase) || DEFAULTS.apiBase,
    token,
    email,
  };
}

export async function saveSettings(partial: Partial<ExtSettings>): Promise<void> {
  const payload: Record<string, string> = {};
  if (partial.apiBase != null) payload.apiBase = partial.apiBase;
  if (partial.token != null) payload.token = partial.token;
  if (partial.email != null) payload.email = partial.email;
  if (Object.keys(payload).length > 0) {
    await chrome.storage.local.set(payload);
  }
}

/** Clears auth token only — keeps email + apiBase so sign-in is easier next time. */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(["token"]);
}
