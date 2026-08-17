/** API origin without trailing slash (e.g. http://localhost:8080). */
export const API_BASE = (
  import.meta.env.VITE_API_BASE ?? "http://localhost:8080"
).replace(/\/$/, "");

/** Dashboard app origin for deep links (e.g. http://localhost:5173). */
export const APP_BASE = (
  import.meta.env.VITE_APP_BASE ?? "http://localhost:5173"
).replace(/\/$/, "");

export const RESUME_THEMES = ["classic", "compact", "academic", "sidebar"] as const;

export type ResumeTheme = (typeof RESUME_THEMES)[number];

export function appUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}${p}`;
}

export function isProPlan(plan: string | null | undefined): boolean {
  const p = (plan ?? "free").toLowerCase();
  return p === "pro" || p === "lifetime";
}

export function formatPlanLabel(
  plan: string | null | undefined,
  opts?: { onTrial?: boolean },
): string {
  if (opts?.onTrial && (plan ?? "free").toLowerCase() === "pro") return "Pro trial";
  switch ((plan ?? "free").toLowerCase()) {
    case "pro":
      return "Pro";
    case "lifetime":
      return "Lifetime";
    case "selfhost":
      return "Self-host";
    default:
      return "Free";
  }
}

export function monthYear(): string {
  return new Date().toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function datetimeLabel(): string {
  return new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
