import { Hono } from "hono";
import type { Config } from "../config.js";
import { createToken } from "../auth/tokens.js";
import { rateLimitResponse } from "../auth/limit.js";
import {
  createPkcePair,
  findOrCreateOAuthUser,
  isOAuthProvider,
  openOAuthState,
  sealOAuthState,
  type AuthUserRow,
  type OAuthProfile,
  type OAuthProvider,
} from "../auth/oauth.js";
import type { FoliyoDb } from "../db.js";
import {
  isGitHubOAuthConfigured,
  isGoogleOAuthConfigured,
  oauthCallbackUrl,
} from "../config.js";

export type OAuthRoutesOptions = {
  /**
   * SaaS hook after a new OAuth user is created (Pro trial, welcome email).
   * Self-host leaves this unset.
   */
  onOAuthUserCreated?: (user: AuthUserRow) => Promise<void>;
};

function providerConfigured(config: Config, provider: OAuthProvider): boolean {
  return provider === "google" ? isGoogleOAuthConfigured(config) : isGitHubOAuthConfigured(config);
}

function clientId(config: Config, provider: OAuthProvider): string {
  return provider === "google" ? config.googleClientId : config.githubClientId;
}

function dashboardErrorRedirect(config: Config, code: string): string {
  const base = config.dashboardUrl.replace(/\/$/, "");
  return `${base}/login?oauth_error=${encodeURIComponent(code)}`;
}

function dashboardSuccessRedirect(config: Config, token: string): string {
  const base = config.dashboardUrl.replace(/\/$/, "");
  return `${base}/oauth/callback?access_token=${encodeURIComponent(token)}`;
}

async function exchangeGoogle(
  config: Config,
  code: string,
  verifier: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: oauthCallbackUrl(config, "google"),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`google_token_${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("google_token_missing");

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) throw new Error(`google_userinfo_${userRes.status}`);
  const u = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
  };
  if (!u.sub || !u.email) throw new Error("google_profile_incomplete");
  const verified = u.email_verified === true || u.email_verified === "true";
  return {
    provider: "google",
    providerUserId: u.sub,
    email: u.email,
    emailVerified: verified,
    name: u.name,
  };
}

async function exchangeGitHub(
  config: Config,
  code: string,
  verifier: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: oauthCallbackUrl(config, "github"),
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`github_token_${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) throw new Error(tokenJson.error || "github_token_missing");

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "foliyo",
    },
  });
  if (!userRes.ok) throw new Error(`github_user_${userRes.status}`);
  const u = (await userRes.json()) as {
    id?: number;
    email?: string | null;
    name?: string | null;
    login?: string;
  };
  if (u.id == null) throw new Error("github_profile_incomplete");

  let email = (u.email ?? "").trim();
  let emailVerified = Boolean(email);

  const emailsRes = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "foliyo",
    },
  });
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primaryVerified = emails.find((e) => e.primary && e.verified);
    const anyVerified = emails.find((e) => e.verified);
    const chosen = primaryVerified ?? anyVerified;
    if (chosen) {
      email = chosen.email;
      emailVerified = true;
    }
  }

  return {
    provider: "github",
    providerUserId: String(u.id),
    email,
    emailVerified,
    name: u.name || u.login || undefined,
  };
}

export function oauthRoutes(db: FoliyoDb, config: Config, options: OAuthRoutesOptions = {}) {
  const r = new Hono();

  r.get("/oauth/providers", (c) => {
    return c.json({
      google: isGoogleOAuthConfigured(config),
      github: isGitHubOAuthConfigured(config),
    });
  });

  r.get("/oauth/:provider/start", async (c) => {
    const providerRaw = c.req.param("provider");
    if (!isOAuthProvider(providerRaw)) {
      return c.json({ error: "unknown_provider" }, 404);
    }
    if (!providerConfigured(config, providerRaw)) {
      return c.json({ error: "provider_not_configured" }, 501);
    }
    const limited = rateLimitResponse(c, "oauth");
    if (limited) return limited;

    const consent =
      c.req.query("consent") === "1" ||
      c.req.query("consent") === "true" ||
      c.req.query("consent") === "yes";

    const { verifier, challenge } = createPkcePair();
    const state = sealOAuthState(config.integritySecret, {
      verifier,
      provider: providerRaw,
      consent,
    });

    const redirectUri = oauthCallbackUrl(config, providerRaw);
    const id = clientId(config, providerRaw);

    if (providerRaw === "google") {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", id);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("access_type", "online");
      url.searchParams.set("prompt", "select_account");
      return c.redirect(url.toString(), 302);
    }

    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return c.redirect(url.toString(), 302);
  });

  r.get("/oauth/:provider/callback", async (c) => {
    const providerRaw = c.req.param("provider");
    const fail = (code: string) => c.redirect(dashboardErrorRedirect(config, code), 302);

    if (!isOAuthProvider(providerRaw)) return fail("unknown_provider");
    if (!providerConfigured(config, providerRaw)) return fail("provider_not_configured");

    const limited = rateLimitResponse(c, "oauth");
    if (limited) return fail("rate_limited");

    const errParam = c.req.query("error");
    if (errParam) return fail(errParam);

    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) return fail("missing_code");

    const payload = openOAuthState(config.integritySecret, state);
    if (!payload || payload.provider !== providerRaw) {
      return fail("invalid_state");
    }

    let profile: OAuthProfile;
    try {
      profile =
        providerRaw === "google"
          ? await exchangeGoogle(config, code, payload.verifier)
          : await exchangeGitHub(config, code, payload.verifier);
    } catch (err) {
      console.error("[oauth] token exchange failed", err);
      return fail("exchange_failed");
    }

    const result = await findOrCreateOAuthUser(db, profile, {
      consent: payload.consent,
      consentIp: c.req.header("x-real-ip") ?? c.req.header("cf-connecting-ip") ?? "",
      consentUa: c.req.header("user-agent") ?? "",
    });

    if (!result.ok) return fail(result.error);

    if (result.created && options.onOAuthUserCreated) {
      try {
        await options.onOAuthUserCreated(result.user);
      } catch (err) {
        console.error("[oauth] onOAuthUserCreated failed", err);
      }
    }

    const session = await createToken(db, result.user.id);
    return c.redirect(dashboardSuccessRedirect(config, session), 302);
  });

  return r;
}
