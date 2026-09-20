const buckets = new Map<string, number[]>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function allowRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const cutoff = now - windowMs;
  const times = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (times.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((times[0]! + windowMs - now) / 1000));
    buckets.set(key, times);
    return { ok: false, retryAfterSec };
  }
  times.push(now);
  buckets.set(key, times);
  return { ok: true };
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const RATE_WINDOWS = {
  hour: 60 * 60 * 1000,
  fifteenMin: 15 * 60 * 1000,
} as const;

/**
 * IP = coarse ceiling (shared NAT / office). Easy to share, hard to rotate.
 * Client = IP + User-Agent (one browser on that network). UA is spoofable, so
 * this is always *under* the IP ceiling — rotating UA cannot exceed `ip`.
 * Email (when present) = per-account cap.
 *
 * Cloudflare is optional: nginx `X-Real-IP $remote_addr` is enough on a VPS.
 */
export const RATE_LIMITS = {
  signup: { ip: 40, client: 8, email: 5, windowMs: RATE_WINDOWS.hour },
  resend: { ip: 30, client: 8, email: 6, windowMs: RATE_WINDOWS.hour },
  forgot: { ip: 30, client: 8, email: 6, windowMs: RATE_WINDOWS.hour },
  login: { ip: 80, client: 20, email: 12, windowMs: RATE_WINDOWS.fifteenMin },
  reset: { ip: 40, client: 15, email: 0, windowMs: RATE_WINDOWS.fifteenMin },
  verify: { ip: 40, client: 15, email: 0, windowMs: RATE_WINDOWS.fifteenMin },
  oauth: { ip: 60, client: 20, email: 0, windowMs: RATE_WINDOWS.fifteenMin },
} as const;

type HeaderSource = { header: (name: string) => string | undefined };

export function clientIp(headers: HeaderSource): string {
  const cf = headers.header("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = headers.header("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}

/** Short, stable id for UA so bucket keys stay small. */
export function userAgentKey(headers: HeaderSource): string {
  const raw = (headers.header("user-agent") ?? "").trim().toLowerCase().slice(0, 180);
  if (!raw) return "none";
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
