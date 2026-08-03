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
import { portfoliosRoutes } from "./routes/portfolios.js";
import { resumesRoutes } from "./routes/resumes.js";
import { blogRoutes } from "./routes/blog.js";
import { settingsRoutes, uploadRoutes } from "./routes/settings.js";
import { publicRoutes } from "./routes/public.js";
import { authMiddleware } from "./middleware/auth.js";

export type CreateFoliyoAppOptions = {
  /** Mount public / SaaS routes here (after /api/auth, before authed /api/*). */
  beforeProtectedApi?: (app: Hono) => void;
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
      origin: config.corsOrigins.includes("*") ? "*" : config.corsOrigins,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Mesh-Query", "X-Mesh-Format"],
      exposeHeaders: ["Content-Length"],
      maxAge: 86400,
    }),
  );

  app.route("/", createMeshRouter(db));
  app.route("/api/auth", authRoutes(db));
  app.route("/", publicRoutes(db, config));

  // Public SaaS routes (signup, handle check, health) must register before the
  // authenticated /api catch-all or they return 401.
  options.beforeProtectedApi?.(app);

  const api = new Hono();
  api.use("*", authMiddleware(db));
  api.route("/profile", profileRoutes(db));
  api.route("/skills", skillsRoutes(db));
  api.route("/projects", projectsRoutes(db));
  api.route("/experience", experienceRoutes(db));
  api.route("/education", educationRoutes(db));
  api.route("/certifications", certificationsRoutes(db));
  api.route("/languages", languagesRoutes(db));
  api.route("/portfolios", portfoliosRoutes(db, config));
  api.route("/resumes", resumesRoutes(db, config));
  api.route("/blog", blogRoutes(db));
  api.route("/upload", uploadRoutes(db, config));
  api.route("/settings", settingsRoutes(db));
  app.route("/api", api);

  return { app, api };
}
