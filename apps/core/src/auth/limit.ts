import { allowRateLimit, clientIp, RATE_LIMITS } from "./rate-limit.js";
import { normalizeEmail } from "./datetime.js";

type Kind = keyof typeof RATE_LIMITS;

export function rateLimitResponse(
  c: {
    req: { header: (name: string) => string | undefined };
    json: (body: unknown, status: 429, headers?: Record<string, string>) => Response;
    header: (name: string, value: string) => void;
  },
  kind: Kind,
  email?: string,
): Response | null {
  const spec = RATE_LIMITS[kind];
  const ip = clientIp(c.req);
  const ipResult = allowRateLimit(`${kind}:ip:${ip}`, spec.ip, spec.windowMs);
  if (!ipResult.ok) {
    c.header("Retry-After", String(ipResult.retryAfterSec));
    return c.json(
      { error: "rate_limited", message: "Too many attempts. Try again later." },
      429,
    );
  }
  if (spec.email > 0 && email) {
    const emailResult = allowRateLimit(
      `${kind}:email:${normalizeEmail(email)}`,
      spec.email,
      spec.windowMs,
    );
    if (!emailResult.ok) {
      c.header("Retry-After", String(emailResult.retryAfterSec));
      return c.json(
        { error: "rate_limited", message: "Too many attempts. Try again later." },
        429,
      );
    }
  }
  return null;
}
