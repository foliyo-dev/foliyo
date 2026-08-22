import type { JobAnalysis, JobAnalysisSummary, SavedJobAnalysis } from "@foliyo/jobs-client";
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

export type PlanEntitlements = {
  portfolios_unlimited: boolean;
  pdf_export: boolean;
  remove_branding: boolean;
  ai_resume_import: boolean;
  ai_assist?: boolean;
  portfolio_limit: number | null;
  resume_limit: number | null;
};

export type PlanInfo = {
  plan: string;
  stored_plan?: string;
  plan_expires: string | null;
  billing_available: boolean;
  on_trial?: boolean;
  trial_ended?: boolean;
  pricing?: {
    monthlyInr: number;
    lifetimeInr: number;
    currency: string;
  };
  entitlements?: PlanEntitlements;
};

export type AiUsage = {
  day: string;
  units: number;
  limit: number;
  remaining: number;
  costs: { import: number; rewrite: number; analyze?: number };
};

export type Resume = {
  id: string;
  portfolio_id: string | null;
  name: string;
  theme_slug: string;
  is_public: number;
  share_token: string;
  view_count: number;
  created_at?: string;
  updated_at?: string;
};

export type ResumeContent = {
  skill_ids: string[];
  project_ids: string[];
  experience_ids: string[];
  education_ids: string[];
  certification_ids: string[];
  language_ids: string[];
};

export type UpgradeError = {
  upgrade: true;
  message: string;
  feature?: string;
  pricing?: PlanInfo["pricing"];
};

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

export function parseUpgradeError(err: unknown): UpgradeError | null {
  if (!(err instanceof ExtApiError)) return null;
  try {
    const body = JSON.parse(err.message) as {
      upgrade?: boolean;
      message?: string;
      feature?: string;
      pricing?: PlanInfo["pricing"];
    };
    if (!body.upgrade) return null;
    return {
      upgrade: true,
      message: body.message || "Upgrade to Pro to unlock this feature.",
      feature: body.feature,
      pricing: body.pricing,
    };
  } catch {
    return null;
  }
}

export function parseApiMessage(err: unknown): string {
  if (!(err instanceof ExtApiError)) {
    return err instanceof Error ? err.message : "Request failed";
  }
  const upgrade = parseUpgradeError(err);
  if (upgrade) return upgrade.message;
  try {
    const body = JSON.parse(err.message) as { error?: string; message?: string };
    return body.message || body.error || err.message;
  } catch {
    return err.message || "Request failed";
  }
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

export function getPlan(settings?: ExtSettings) {
  return request<PlanInfo>("/api/plan", {}, settings);
}

export function getAiUsage(settings?: ExtSettings) {
  return request<AiUsage>("/api/ai/usage", {}, settings);
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

export function listResumes(settings?: ExtSettings) {
  return request<Resume[]>("/api/resumes", {}, settings);
}

export function getResumeContent(id: string, settings?: ExtSettings) {
  return request<ResumeContent>(`/api/resumes/${id}/content`, {}, settings);
}

export function listProjects(settings?: ExtSettings) {
  return request<Array<{ id: string; title: string }>>("/api/projects", {}, settings);
}

export function listExperience(settings?: ExtSettings) {
  return request<Array<{ id: string; company: string; role: string }>>("/api/experience", {}, settings);
}

export function listEducation(settings?: ExtSettings) {
  return request<Array<{ id: string; institution: string; degree: string }>>(
    "/api/education",
    {},
    settings,
  );
}

export function listCertifications(settings?: ExtSettings) {
  return request<Array<{ id: string; name: string; issuer: string }>>(
    "/api/certifications",
    {},
    settings,
  );
}

export function listLanguages(settings?: ExtSettings) {
  return request<Array<{ id: string; name: string; proficiency: string }>>(
    "/api/languages",
    {},
    settings,
  );
}

export function analyzeJob(
  body: {
    jd_text: string;
    portfolio_id?: string;
    resume_id?: string;
    enhance?: boolean;
  },
  settings?: ExtSettings,
) {
  return request<JobAnalysis>("/api/jobs/analyze", { method: "POST", body: JSON.stringify(body) }, settings);
}

export function listJobAnalyses(settings?: ExtSettings) {
  return request<{ items: JobAnalysisSummary[] }>("/api/jobs/analyses", {}, settings);
}

export function getSavedJobAnalysis(id: string, settings?: ExtSettings) {
  return request<SavedJobAnalysis>(`/api/jobs/analyses/${id}`, {}, settings);
}

export function patchJobAnalysisAccepted(id: string, accepted: string[], settings?: ExtSettings) {
  return request<SavedJobAnalysis>(
    `/api/jobs/analyses/${id}`,
    { method: "PUT", body: JSON.stringify({ accepted }) },
    settings,
  );
}

export function tailorResume(
  body: {
    name: string;
    portfolio_id?: string | null;
    skill_ids?: string[];
    jd_text?: string;
    include_matching?: boolean;
    theme_slug?: string;
    is_public?: number;
    approved?: { skill_ids: string[]; project_ids?: string[]; experience_ids?: string[] };
  },
  settings?: ExtSettings,
) {
  return request<{
    resume: { id: string; name: string; share_token: string };
    matched_skill_ids: string[];
  }>("/api/resumes/tailor", { method: "POST", body: JSON.stringify(body) }, settings);
}

export function createResume(
  body: {
    name: string;
    portfolio_id: string;
    theme_slug?: string;
    content?: ResumeContent;
  },
  settings?: ExtSettings,
) {
  return request<Resume[]>("/api/resumes", { method: "POST", body: JSON.stringify(body) }, settings);
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
