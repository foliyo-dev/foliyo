import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

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

function corsOrigins(): string[] {
  const v = env("FOLIYO_CORS_ORIGINS");
  if (v === "*") return ["*"];
  if (v) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Local defaults: OSS dashboard :5173, cloud-web :5174, landing :5175
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
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

  return {
    port: envInt("FOLIYO_PORT", Number.parseInt(y("port", "8080"), 10)),
    host: env("FOLIYO_HOST", y("host", "0.0.0.0")),
    dbDriver,
    dbPath: env("FOLIYO_DB_PATH", y("db_path", "./data/foliyo.db")),
    dbUrl,
    dataDir: env("FOLIYO_DATA_DIR", y("data_dir", "./data")),
    adminEmail: env("FOLIYO_ADMIN_EMAIL", y("admin_email", "")),
    adminPassword: env("FOLIYO_ADMIN_PASSWORD", y("admin_password", "")),
    tokenSecret: env("FOLIYO_TOKEN_SECRET", y("token_secret", "dev-token-secret")),
    integritySecret: env("FOLIYO_INTEGRITY_SECRET", y("integrity_secret", "dev-integrity-secret")),
    masterSecret: env("FOLIYO_MASTER_SECRET", y("master_secret", "dev-master-secret")),
    mode: (env("FOLIYO_MODE", y("mode", "single")) as Config["mode"]),
    siteUrl: env("FOLIYO_SITE_URL", y("site_url", "http://localhost:8080")),
    dashboardUrl: env("FOLIYO_DASHBOARD_URL", y("dashboard_url", "http://localhost:5173")),
    corsOrigins: corsOrigins(),
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
  };
}
