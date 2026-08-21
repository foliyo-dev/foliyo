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

export const RATE_LIMITS = {
  signup: { ip: 5, email: 3, windowMs: RATE_WINDOWS.hour },
  resend: { ip: 5, email: 3, windowMs: RATE_WINDOWS.hour },
  forgot: { ip: 5, email: 3, windowMs: RATE_WINDOWS.hour },
  login: { ip: 10, email: 5, windowMs: RATE_WINDOWS.fifteenMin },
  reset: { ip: 10, email: 0, windowMs: RATE_WINDOWS.fifteenMin },
  verify: { ip: 10, email: 0, windowMs: RATE_WINDOWS.fifteenMin },
} as const;

export function clientIp(headers: { header: (name: string) => string | undefined }): string {
  const real = headers.header("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}
