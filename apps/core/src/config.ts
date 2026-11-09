import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { OpenRouterClientConfig } from "./ai/types.js";

export interface Config {
  port: number;
  host: string;
  dbDriver: "sqlite" | "postgres";
  dbPath: string;
  dbUrl: string;
  dataDir: string;
  adminEmail: string;
  adminPassword: string;
  tokenSecret: string;
  integritySecret: string;
  masterSecret: string;
  mode: "single" | "multi";
  siteUrl: string;
  dashboardUrl: string;
  corsOrigins: string[];
  /** Explicit `chrome-extension://` / `moz-extension://` origins. Empty = allow any only in dev. */
  extensionOrigins: string[];
  /** False when NODE_ENV/FOLIYO_ENV is production, or siteUrl is not loopback. */
  dev: boolean;
  logLevel: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  /** Force TLS (SMTPS). Default true only when port is 465. */
  smtpSecure: boolean;
  /** Skip STARTTLS — required for MailHog / Mailpit. */
  smtpIgnoreTls: boolean;
  /**
   * Master switch for Google/GitHub login (self-host and hosted).
   * When false, providers stay off even if client secrets are set.
   * Default true — leave secrets empty to disable a provider.
   */
  oauthEnabled: boolean;
  /** Public API origin for OAuth redirect URIs (defaults to siteUrl). */
  oauthRedirectBase: string;
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  /** Optional BYOK OpenRouter key for OSS AI (resume import, rewrite, theme, JD enhance). */
  openRouterApiKey: string;
  openRouterModel: string;
  /** max_tokens for rewrite / summary helpers. */
  aiRewriteMaxTokens: number;
  /** File uploads: local disk (default) or S3-compatible (AWS/R2/MinIO). */
  storageDriver: "local" | "s3";
  s3Bucket: string;
  s3Region: string;
  /** Empty = AWS default endpoint; set for R2/MinIO. */
  s3Endpoint: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  /** Object key prefix, always stored with trailing slash. */
  s3Prefix: string;
  s3ForcePathStyle: boolean;
}

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const DEV_SECRETS = new Set(["dev-integrity-secret", "dev-master-secret", "dev-token-secret"]);

function isLoopbackHost(siteUrl: string): boolean {
  try {
    const host = new URL(siteUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}

function isDevRuntime(siteUrl: string): boolean {
  const node = (process.env.NODE_ENV ?? "").toLowerCase();
  const foliyo = (process.env.FOLIYO_ENV ?? "").toLowerCase();
  if (node === "production" || foliyo === "production" || foliyo === "prod") return false;
  return isLoopbackHost(siteUrl);
}

function extensionOrigins(): string[] {
  const v = env("FOLIYO_EXTENSION_ORIGINS");
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsOrigins(): string[] {
  const v = env("FOLIYO_CORS_ORIGINS");
  if (v === "*") return ["*"];
  if (v) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Local defaults: OSS dashboard :5173, cloud-web :5174, landing :5175, admin :5176
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
  ];
}

function loadYamlConfig(): Record<string, unknown> {
  const paths = [
    resolve(process.cwd(), "config.yml"),
    resolve(process.cwd(), "apps/core/config.yml"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      return parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    }
  }
  return {};
}

export function loadConfig(): Config {
  const yaml = loadYamlConfig();
  const y = (key: string, fallback: string) =>
    (yaml[key] as string | undefined) ?? fallback;

  const dbDriverRaw = env("FOLIYO_DB_DRIVER", y("db_driver", "sqlite")).toLowerCase();
  if (dbDriverRaw !== "sqlite" && dbDriverRaw !== "postgres") {
    throw new Error(`Invalid FOLIYO_DB_DRIVER=${dbDriverRaw}. Use sqlite or postgres.`);
  }
  const dbDriver = dbDriverRaw as Config["dbDriver"];
  const dbUrl = env("FOLIYO_DB_URL", y("db_url", ""));
  if (dbDriver === "postgres" && !dbUrl) {
    throw new Error("FOLIYO_DB_URL is required when FOLIYO_DB_DRIVER=postgres");
  }

  const siteUrl = env("FOLIYO_SITE_URL", y("site_url", "http://localhost:8080"));
  const tokenSecret = env("FOLIYO_TOKEN_SECRET", y("token_secret", "dev-token-secret"));
  const integritySecret = env("FOLIYO_INTEGRITY_SECRET", y("integrity_secret", "dev-integrity-secret"));
  const masterSecret = env("FOLIYO_MASTER_SECRET", y("master_secret", "dev-master-secret"));
  const dev = isDevRuntime(siteUrl);

  if (!dev) {
    const missing: string[] = [];
    if (DEV_SECRETS.has(integritySecret) || !integritySecret) missing.push("FOLIYO_INTEGRITY_SECRET");
    if (DEV_SECRETS.has(masterSecret) || !masterSecret) missing.push("FOLIYO_MASTER_SECRET");
    if (DEV_SECRETS.has(tokenSecret) || !tokenSecret) missing.push("FOLIYO_TOKEN_SECRET");
    if (missing.length) {
      throw new Error(
        `Refusing to start with default secrets in production. Set ${missing.join(", ")}.`,
      );
    }
  }

  return {
    port: envInt("FOLIYO_PORT", Number.parseInt(y("port", "8080"), 10)),
    host: env("FOLIYO_HOST", y("host", "0.0.0.0")),
    dbDriver,
    dbPath: env("FOLIYO_DB_PATH", y("db_path", "./data/foliyo.db")),
    dbUrl,
    dataDir: env("FOLIYO_DATA_DIR", y("data_dir", "./data")),
    adminEmail: env("FOLIYO_ADMIN_EMAIL", y("admin_email", "")),
    adminPassword: env("FOLIYO_ADMIN_PASSWORD", y("admin_password", "")),
    tokenSecret,
    integritySecret,
    masterSecret,
    mode: (env("FOLIYO_MODE", y("mode", "single")) as Config["mode"]),
    siteUrl,
    dashboardUrl: env("FOLIYO_DASHBOARD_URL", y("dashboard_url", "http://localhost:5173")),
    corsOrigins: corsOrigins(),
    extensionOrigins: extensionOrigins(),
    dev,
    logLevel: env("FOLIYO_LOG_LEVEL", y("log_level", "info")),
    smtpHost: env("FOLIYO_SMTP_HOST", y("smtp_host", "")),
    smtpPort: envInt("FOLIYO_SMTP_PORT", Number.parseInt(y("smtp_port", "587"), 10)),
    smtpUser: env("FOLIYO_SMTP_USER", y("smtp_user", "")),
    smtpPass: env("FOLIYO_SMTP_PASS", y("smtp_pass", "")),
    fromEmail: env("FOLIYO_FROM_EMAIL", y("from_email", "")),
    smtpSecure: envBool(
      "FOLIYO_SMTP_SECURE",
      envInt("FOLIYO_SMTP_PORT", Number.parseInt(y("smtp_port", "587"), 10)) === 465,
    ),
    smtpIgnoreTls: envBool("FOLIYO_SMTP_IGNORE_TLS", false),
    oauthEnabled: envBool("FOLIYO_OAUTH_ENABLED", true),
    oauthRedirectBase: env("OAUTH_REDIRECT_BASE", siteUrl).replace(/\/$/, ""),
    googleClientId: env("GOOGLE_CLIENT_ID").trim(),
    googleClientSecret: env("GOOGLE_CLIENT_SECRET").trim(),
    githubClientId: env("GITHUB_CLIENT_ID").trim(),
    githubClientSecret: env("GITHUB_CLIENT_SECRET").trim(),
    openRouterApiKey: env("OPENROUTER_API_KEY").trim(),
    openRouterModel: env("OPENROUTER_MODEL", "google/gemini-2.5-flash").trim() || "google/gemini-2.5-flash",
    aiRewriteMaxTokens: (() => {
      const n = Number.parseInt(env("AI_REWRITE_MAX_TOKENS", "400"), 10);
      return Number.isFinite(n) && n > 64 ? n : 400;
    })(),
    ...loadStorageConfig(),
  };
}

function loadStorageConfig(): Pick<
  Config,
  | "storageDriver"
  | "s3Bucket"
  | "s3Region"
  | "s3Endpoint"
  | "s3AccessKeyId"
  | "s3SecretAccessKey"
  | "s3Prefix"
  | "s3ForcePathStyle"
> {
  const raw = env("FOLIYO_STORAGE", "local").trim().toLowerCase();
  const storageDriver: Config["storageDriver"] = raw === "s3" ? "s3" : "local";
  let prefix = env("FOLIYO_S3_PREFIX", "uploads/").trim() || "uploads/";
  if (!prefix.endsWith("/")) prefix = `${prefix}/`;
  const s3 = {
    storageDriver,
    s3Bucket: env("FOLIYO_S3_BUCKET").trim(),
    s3Region: env("FOLIYO_S3_REGION", "auto").trim() || "auto",
    s3Endpoint: env("FOLIYO_S3_ENDPOINT").trim(),
    s3AccessKeyId: env("FOLIYO_S3_ACCESS_KEY_ID").trim(),
    s3SecretAccessKey: env("FOLIYO_S3_SECRET_ACCESS_KEY").trim(),
    s3Prefix: prefix,
    s3ForcePathStyle: envBool("FOLIYO_S3_FORCE_PATH_STYLE", Boolean(env("FOLIYO_S3_ENDPOINT").trim())),
  };
  if (storageDriver === "s3") {
    const missing: string[] = [];
    if (!s3.s3Bucket) missing.push("FOLIYO_S3_BUCKET");
    if (!s3.s3AccessKeyId) missing.push("FOLIYO_S3_ACCESS_KEY_ID");
    if (!s3.s3SecretAccessKey) missing.push("FOLIYO_S3_SECRET_ACCESS_KEY");
    if (missing.length) {
      throw new Error(
        `FOLIYO_STORAGE=s3 requires ${missing.join(", ")}. Or set FOLIYO_STORAGE=local.`,
      );
    }
  }
  return s3;
}

export function openRouterFromConfig(config: Config): OpenRouterClientConfig {
  return {
    openRouterApiKey: config.openRouterApiKey,
    openRouterModel: config.openRouterModel,
    dashboardUrl: config.dashboardUrl,
    aiRewriteMaxTokens: config.aiRewriteMaxTokens,
  };
}

export function isOpenRouterConfigured(config: Pick<Config, "openRouterApiKey">): boolean {
  return Boolean(config.openRouterApiKey);
}

export function isGoogleOAuthConfigured(
  config: Pick<Config, "oauthEnabled" | "googleClientId" | "googleClientSecret">,
): boolean {
  return config.oauthEnabled && Boolean(config.googleClientId && config.googleClientSecret);
}

export function isGitHubOAuthConfigured(
  config: Pick<Config, "oauthEnabled" | "githubClientId" | "githubClientSecret">,
): boolean {
  return config.oauthEnabled && Boolean(config.githubClientId && config.githubClientSecret);
}

export function oauthRedirectBase(config: Pick<Config, "oauthRedirectBase">): string {
  return config.oauthRedirectBase.replace(/\/$/, "");
}

export function oauthCallbackUrl(
  config: Pick<Config, "oauthRedirectBase">,
  provider: "google" | "github",
): string {
  return `${oauthRedirectBase(config)}/api/auth/oauth/${provider}/callback`;
}
