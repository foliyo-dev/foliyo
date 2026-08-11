import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Config } from "./config.js";
import type { FoliyoDb } from "./db.js";
import { createMeshRouter } from "./schema/index.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { skillsRoutes } from "./routes/skills.js";
import { projectsRoutes } from "./routes/projects.js";
import { experienceRoutes } from "./routes/experience.js";
import { educationRoutes } from "./routes/education.js";
import { certificationsRoutes } from "./routes/certifications.js";
import { languagesRoutes } from "./routes/languages.js";
import { socialLinksRoutes } from "./routes/social-links.js";
import { portfoliosRoutes } from "./routes/portfolios.js";
import { resumesRoutes } from "./routes/resumes.js";
import { applicationsRoutes } from "./routes/applications.js";
import { blogRoutes } from "./routes/blog.js";
import { settingsRoutes, uploadRoutes } from "./routes/settings.js";
import { previewRoutes } from "./routes/preview.js";
import { publicRoutes } from "./routes/public.js";
import { specRoutes } from "./routes/spec.js";
import { statusNotifyRoutes } from "./routes/status-notify.js";
import { fioImportRoutes } from "./routes/fio-import.js";
import { authMiddleware } from "./middleware/auth.js";

export type CreateFoliyoAppOptions = {
  /** Mount public / SaaS routes here (after mesh/public, before core /api/auth). */
  beforeProtectedApi?: (app: Hono) => void;
  /**
   * Add authed routes to the /api sub-app before it is mounted.
   * Required for Hono: routes added to `api` after `app.route("/api", api)` are ignored.
   */
  extendApi?: (api: Hono) => void;
};

/** Build the Foliyo Hono app without starting the server — used by foliyo-cloud to mount SaaS routes. */
export function createFoliyoApp(
  db: FoliyoDb,
  config: Config,
  options: CreateFoliyoAppOptions = {},
): { app: Hono; api: Hono } {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: (origin) => {
        // No Origin (curl, same-origin server tools)
        if (!origin) return "*";
        if (config.corsOrigins.includes("*")) return origin;
        if (config.corsOrigins.includes(origin)) return origin;
        // Browser extensions (popup / SW) — auth still required on API routes
        if (
          origin.startsWith("chrome-extension://") ||
          origin.startsWith("moz-extension://")
        ) {
          return origin;
        }
        return null;
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Mesh-Query",
        "X-Mesh-Format",
        "X-Mesh-Token",
        "X-Mesh-Signature",
        "X-Mesh-Version",
      ],
      exposeHeaders: ["Content-Length", "Content-Disposition", "X-Foliyo-Export", "X-Foliyo-Content-Hash"],
      maxAge: 86400,
    }),
  );

  app.route("/", createMeshRouter(db, config));
  app.route("/", publicRoutes(db, config));
  // Foliyo Resume Spec — public verify + ATS status notify (HMAC + API key)
  app.route("/v1", specRoutes(db, config));
  app.route("/v1", statusNotifyRoutes(db, config));

  // SaaS public routes (signup, verify, handle check) before core /api/auth
  // so hosted signup is not shadowed by OSS auth routes.
  options.beforeProtectedApi?.(app);

  app.route("/api/auth", authRoutes(db));

  const api = new Hono();
  api.use("*", authMiddleware(db));
  api.route("/profile", profileRoutes(db));
  api.route("/skills", skillsRoutes(db));
  api.route("/projects", projectsRoutes(db));
  api.route("/experience", experienceRoutes(db));
  api.route("/education", educationRoutes(db));
  api.route("/certifications", certificationsRoutes(db));
  api.route("/languages", languagesRoutes(db));
  api.route("/social-links", socialLinksRoutes(db));
  api.route("/portfolios", portfoliosRoutes(db, config));
  api.route("/resumes", resumesRoutes(db, config));
  api.route("/applications", applicationsRoutes(db));
  api.route("/blog", blogRoutes(db));
  api.route("/upload", uploadRoutes(db, config));
  api.route("/settings", settingsRoutes(db));
  api.route("/import", fioImportRoutes(db, config));
  api.route("/preview", previewRoutes(db, config));
  // Cloud (and other hosts) must register here — not after createFoliyoApp returns.
  options.extendApi?.(api);
  app.route("/api", api);

  return { app, api };
}
