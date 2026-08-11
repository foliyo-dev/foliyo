import { loadSettings, type ExtSettings } from "./storage";
import type { ApiRequestMessage, ApiResponseMessage } from "./background";

export class ExtApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function extensionFetch(msg: Omit<ApiRequestMessage, "type">): Promise<ApiResponseMessage> {
  let res: ApiResponseMessage | undefined;
  try {
    res = await chrome.runtime.sendMessage({ type: "foliyo-api", ...msg } satisfies ApiRequestMessage);
  } catch (err) {
    throw new ExtApiError(
      err instanceof Error ? err.message : "Extension background unavailable",
      0,
    );
  }
  if (!res) {
    throw new ExtApiError("Extension background unavailable — reopen the popup", 0);
  }
  return res;
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  settings?: ExtSettings,
): Promise<T> {
  const s = settings ?? (await loadSettings());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (s.token) headers.Authorization = `Bearer ${s.token}`;

  const res = await extensionFetch({
    path,
    method: opts.method ?? "GET",
    headers,
    body: typeof opts.body === "string" ? opts.body : opts.body != null ? String(opts.body) : null,
    apiBase: s.apiBase,
  });

  if (!res.ok) {
    throw new ExtApiError(res.error || "request failed", res.status);
  }
  if (res.status === 204 || !res.bodyText) return undefined as T;
  return JSON.parse(res.bodyText) as T;
}

export function login(email: string, password: string, settings?: ExtSettings) {
  return request<{ token: string; user: { email: string; plan: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    settings,
  );
}

export function me(settings?: ExtSettings) {
  return request<{ user: { email: string; plan: string } }>("/api/auth/me", {}, settings);
}

export function listSkills(settings?: ExtSettings) {
  return request<Array<{ id: string; name: string; level: string; status?: string }>>(
    "/api/skills?status=confirmed",
    {},
    settings,
  );
}

export function listPortfolios(settings?: ExtSettings) {
  return request<Array<{ id: string; name: string }>>("/api/portfolios", {}, settings);
}

export function tailorResume(
  body: {
    name: string;
    portfolio_id: string;
    skill_ids?: string[];
    jd_text?: string;
    include_matching?: boolean;
    theme_slug?: string;
  },
  settings?: ExtSettings,
) {
  return request<{
    resume: { id: string; name: string; share_token: string };
    matched_skill_ids: string[];
  }>("/api/resumes/tailor", { method: "POST", body: JSON.stringify(body) }, settings);
}

export async function downloadFio(resumeId: string, filename: string, settings?: ExtSettings) {
  const s = settings ?? (await loadSettings());
  const headers: Record<string, string> = {};
  if (s.token) headers.Authorization = `Bearer ${s.token}`;

  const res = await extensionFetch({
    path: `/api/resumes/${resumeId}/export.fio`,
    method: "GET",
    headers,
    apiBase: s.apiBase,
    binary: true,
  });

  if (!res.ok || !res.bodyBase64) {
    throw new ExtApiError(res.ok ? "empty download" : res.error, res.status);
  }

  const binary = atob(res.bodyBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: res.contentType ?? "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^\w\-]+/g, "_") || "resume"}.fio`;
  a.click();
  URL.revokeObjectURL(url);
}
