import { allowRateLimit, clientIp, RATE_LIMITS, userAgentKey } from "./rate-limit.js";
import { normalizeEmail } from "./datetime.js";

type Kind = keyof typeof RATE_LIMITS;

function limited(
  c: {
    json: (body: unknown, status: 429, headers?: Record<string, string>) => Response;
    header: (name: string, value: string) => void;
  },
  retryAfterSec: number,
): Response {
  c.header("Retry-After", String(retryAfterSec));
  return c.json(
    { error: "rate_limited", message: "Too many attempts. Try again later." },
    429,
  );
}

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
  // Missing proxy headers would otherwise put every visitor in one bucket.
  // Do not key on UA alone — every Chrome user would share a global bucket.
  if (ip !== "unknown") {
    const ipResult = allowRateLimit(`${kind}:ip:${ip}`, spec.ip, spec.windowMs);
    if (!ipResult.ok) return limited(c, ipResult.retryAfterSec);

    const clientResult = allowRateLimit(
      `${kind}:client:${ip}:${userAgentKey(c.req)}`,
      spec.client,
      spec.windowMs,
    );
    if (!clientResult.ok) return limited(c, clientResult.retryAfterSec);
  }
  if (spec.email > 0 && email) {
    const emailResult = allowRateLimit(
      `${kind}:email:${normalizeEmail(email)}`,
      spec.email,
      spec.windowMs,
    );
    if (!emailResult.ok) return limited(c, emailResult.retryAfterSec);
  }
  return null;
}
