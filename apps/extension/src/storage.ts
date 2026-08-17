import { API_BASE } from "./config";

export type ExtSettings = {
  apiBase: string;
  token: string | null;
  email: string | null;
  portfolioId: string | null;
  themeSlug: string;
};

export type JdResumeEntry = {
  resumeId: string;
  portfolioId: string;
  name: string;
  createdAt: string;
};

const DEFAULTS: ExtSettings = {
  apiBase: API_BASE,
  token: null,
  email: null,
  portfolioId: null,
  themeSlug: "classic",
};

export async function loadSettings(): Promise<ExtSettings> {
  const stored = await chrome.storage.local.get([
    "apiBase",
    "token",
    "email",
    "portfolioId",
    "themeSlug",
  ]);
  const token = typeof stored.token === "string" && stored.token.length > 0 ? stored.token : null;
  const email = typeof stored.email === "string" && stored.email.length > 0 ? stored.email : null;
  const portfolioId =
    typeof stored.portfolioId === "string" && stored.portfolioId.length > 0
      ? stored.portfolioId
      : null;
  const themeSlug =
    typeof stored.themeSlug === "string" && stored.themeSlug.length > 0
      ? stored.themeSlug
      : DEFAULTS.themeSlug;
  return {
    apiBase: API_BASE,
    token,
    email,
    portfolioId,
    themeSlug,
  };
}

export async function saveSettings(partial: Partial<ExtSettings>): Promise<void> {
  const payload: Record<string, string> = {};
  if (partial.token != null) payload.token = partial.token;
  if (partial.email != null) payload.email = partial.email;
  if (partial.portfolioId != null) payload.portfolioId = partial.portfolioId;
  if (partial.themeSlug != null) payload.themeSlug = partial.themeSlug;
  if (Object.keys(payload).length > 0) {
    await chrome.storage.local.set(payload);
  }
}

/** Clears auth token only — keeps email for easier sign-in. */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(["token"]);
}

export async function loadJdResumeCache(): Promise<Record<string, JdResumeEntry>> {
  const stored = await chrome.storage.local.get(["jdResumeCache"]);
  const raw = stored.jdResumeCache;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, JdResumeEntry>;
}

export async function saveJdResumeCacheEntry(hash: string, entry: JdResumeEntry): Promise<void> {
  const cache = await loadJdResumeCache();
  cache[hash] = entry;
  await chrome.storage.local.set({ jdResumeCache: cache });
}

export type JdDraft = {
  jdText: string;
  analysisId: string | null;
  accepted: string[];
  enhanceParse: boolean;
  showDetails: boolean;
};

export async function loadJdDraft(): Promise<JdDraft | null> {
  const stored = await chrome.storage.local.get(["jdDraft"]);
  const raw = stored.jdDraft;
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Partial<JdDraft>;
  return {
    jdText: typeof draft.jdText === "string" ? draft.jdText : "",
    analysisId: typeof draft.analysisId === "string" ? draft.analysisId : null,
    accepted: Array.isArray(draft.accepted) ? draft.accepted.map(String) : [],
    enhanceParse: Boolean(draft.enhanceParse),
    showDetails: Boolean(draft.showDetails),
  };
}

export async function saveJdDraft(draft: JdDraft): Promise<void> {
  if (!draft.jdText.trim() && !draft.analysisId) {
    await chrome.storage.local.remove(["jdDraft"]);
    return;
  }
  await chrome.storage.local.set({ jdDraft: draft });
}
