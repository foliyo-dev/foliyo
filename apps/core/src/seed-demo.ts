/**
 * Demo seed — fills admin + two sample personas for local visualization.
 *
 *   cd apps/core && pnpm seed:demo
 *   cd apps/core && pnpm seed:demo -- --force   # wipe & reseed demo users + admin library
 *
 * Logins (password: changeme unless overridden):
 *   admin@localhost          — Free, backend-focused, 1 portfolio
 *   priya@demo.foliyo        — Pro, multi-portfolio (backend + opensource)
 *   arjun@demo.foliyo        — Free, design / product folio
 */
import { createHash, randomBytes } from "node:crypto";
import { loadConfig } from "./config.js";
import { openDatabase, queryAll, queryOne, run, type FoliyoDb } from "./db.js";
import { runMigrations } from "./migrate.js";
import { hashPassword } from "./auth/password.js";
import { ensureHandles } from "./public/pages.js";

const DEMO_PASSWORD = process.env.FOLIYO_DEMO_PASSWORD || "changeme";
const force = process.argv.includes("--force");

function id(): string {
  return randomBytes(16).toString("hex");
}

function gravatar(email: string, size = 200): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

function clearUserLibrary(db: FoliyoDb, userId: string): void {
  const portfolios = queryAll<{ id: string }>(db, "SELECT id FROM portfolios WHERE user_id = ?", [userId]);
  for (const p of portfolios) {
    run(db, "DELETE FROM portfolio_skills WHERE portfolio_id = ?", [p.id]);
    run(db, "DELETE FROM portfolio_projects WHERE portfolio_id = ?", [p.id]);
    run(db, "DELETE FROM portfolio_experience WHERE portfolio_id = ?", [p.id]);
    run(db, "DELETE FROM portfolio_education WHERE portfolio_id = ?", [p.id]);
    run(db, "DELETE FROM portfolio_certifications WHERE portfolio_id = ?", [p.id]);
    run(db, "DELETE FROM portfolio_languages WHERE portfolio_id = ?", [p.id]);
  }
  run(db, "DELETE FROM resumes WHERE user_id = ?", [userId]);
  run(db, "DELETE FROM portfolios WHERE user_id = ?", [userId]);
  run(db, "DELETE FROM skills WHERE user_id = ?", [userId]);
  run(db, "DELETE FROM projects WHERE user_id = ?", [userId]);
  run(db, "DELETE FROM experience WHERE user_id = ?", [userId]);
  run(db, "DELETE FROM education WHERE user_id = ?", [userId]);
  run(db, "DELETE FROM certifications WHERE user_id = ?", [userId]);
  run(db, "DELETE FROM languages WHERE user_id = ?", [userId]);
}

function ensureUser(
  db: FoliyoDb,
  opts: {
    email: string;
    handle: string;
    plan: string;
    name: string;
    password?: string;
  },
): string {
  let user = queryOne<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [opts.email]);
  if (!user) {
    run(
      db,
      `INSERT INTO users (email, password, handle, plan, onboarding_complete)
       VALUES (?,?,?,?,1)`,
      [opts.email, hashPassword(opts.password ?? DEMO_PASSWORD), opts.handle, opts.plan],
    );
    user = queryOne<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [opts.email]);
  } else {
    run(
      db,
      `UPDATE users SET handle=?, plan=?, onboarding_complete=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [opts.handle, opts.plan, user.id],
    );
  }
  if (!user) throw new Error(`user ${opts.email} missing`);

  const profile = queryOne(db, "SELECT id FROM profile WHERE user_id = ?", [user.id]);
  if (!profile) {
    run(db, "INSERT INTO profile (user_id, name) VALUES (?, ?)", [user.id, opts.name]);
  }
  const settings = queryOne(db, "SELECT id FROM settings WHERE user_id = ?", [user.id]);
  if (!settings) {
    run(db, "INSERT INTO settings (user_id) VALUES (?)", [user.id]);
  }
  return user.id;
}

type SeedBundle = {
  profile: {
    name: string;
    headline: string;
    bio: string;
    location: string;
    email: string;
    website: string;
    github: string;
    linkedin: string;
    twitter: string;
  };
  skills: { name: string; level: string; category: string }[];
  projects: {
    title: string;
    description: string;
    url: string;
    repo_url: string;
    tags: string;
    featured: number;
  }[];
  experience: {
    company: string;
    role: string;
    location: string;
    start_date: string;
    end_date: string | null;
    description: string;
  }[];
  education: {
    institution: string;
    degree: string;
    field: string;
    start_date: string;
    end_date: string | null;
  }[];
  certifications: { name: string; issuer: string; credential_url: string; issued_at: string }[];
  languages: { name: string; proficiency: string }[];
  portfolios: {
    name: string;
    slug: string;
    description: string;
    headline: string;
    bio: string;
    theme_slug: string;
    is_public: number;
    is_default: number;
    skillIndexes: number[];
    projectIndexes: number[];
    experienceIndexes: number[];
    educationIndexes: number[];
    certificationIndexes: number[];
    languageIndexes: number[];
  }[];
  resume?: { name: string; theme_slug: string; portfolioIndex: number };
};

function seedLibrary(db: FoliyoDb, userId: string, email: string, data: SeedBundle): void {
  const hasSkills = queryOne<{ c: number }>(
    db,
    "SELECT COUNT(*) as c FROM skills WHERE user_id = ?",
    [userId],
  );
  if (!force && (hasSkills?.c ?? 0) > 0) {
    console.log(`  skip library (already has data) — use --force to replace`);
    return;
  }
  if (force) clearUserLibrary(db, userId);

  const p = data.profile;
  run(
    db,
    `UPDATE profile SET name=?, headline=?, bio=?, avatar_url=?, location=?,
     email=?, website=?, github=?, linkedin=?, twitter=?, updated_at=CURRENT_TIMESTAMP
     WHERE user_id=?`,
    [
      p.name,
      p.headline,
      p.bio,
      gravatar(email),
      p.location,
      p.email,
      p.website,
      p.github,
      p.linkedin,
      p.twitter,
      userId,
    ],
  );

  const skillIds: string[] = [];
  data.skills.forEach((s, i) => {
    const sid = id();
    run(
      db,
      `INSERT INTO skills (id, user_id, name, level, category, sort_order) VALUES (?,?,?,?,?,?)`,
      [sid, userId, s.name, s.level, s.category, i],
    );
    skillIds.push(sid);
  });

  const projectIds: string[] = [];
  data.projects.forEach((pr, i) => {
    const pid = id();
    run(
      db,
      `INSERT INTO projects (id, user_id, title, description, url, repo_url, tags, featured, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [pid, userId, pr.title, pr.description, pr.url, pr.repo_url, pr.tags, pr.featured, i],
    );
    projectIds.push(pid);
  });

  const experienceIds: string[] = [];
  data.experience.forEach((e, i) => {
    const eid = id();
    run(
      db,
      `INSERT INTO experience (id, user_id, company, role, location, start_date, end_date, description, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [eid, userId, e.company, e.role, e.location, e.start_date, e.end_date, e.description, i],
    );
    experienceIds.push(eid);
  });

  const educationIds: string[] = [];
  data.education.forEach((e, i) => {
    const eid = id();
    run(
      db,
      `INSERT INTO education (id, user_id, institution, degree, field, start_date, end_date, sort_order)
       VALUES (?,?,?,?,?,?,?,?)`,
      [eid, userId, e.institution, e.degree, e.field, e.start_date, e.end_date, i],
    );
    educationIds.push(eid);
  });

  const certificationIds: string[] = [];
  data.certifications.forEach((c, i) => {
    const cid = id();
    run(
      db,
      `INSERT INTO certifications (id, user_id, name, issuer, credential_url, issued_at, sort_order)
       VALUES (?,?,?,?,?,?,?)`,
      [cid, userId, c.name, c.issuer, c.credential_url, c.issued_at, i],
    );
    certificationIds.push(cid);
  });

  const languageIds: string[] = [];
  data.languages.forEach((l, i) => {
    const lid = id();
    run(
      db,
      `INSERT INTO languages (id, user_id, name, proficiency, sort_order) VALUES (?,?,?,?,?)`,
      [lid, userId, l.name, l.proficiency, i],
    );
    languageIds.push(lid);
  });

  const portfolioIds: string[] = [];
  for (const fol of data.portfolios) {
    if (fol.is_default) {
      run(db, "UPDATE portfolios SET is_default=0 WHERE user_id=?", [userId]);
    }
    const pid = id();
    run(
      db,
      `INSERT INTO portfolios (
         id, user_id, name, slug, description, headline, bio, theme_slug,
         is_public, is_default, show_skills, show_projects, show_experience,
         show_education, show_certifications, show_languages, sort_order
       ) VALUES (?,?,?,?,?,?,?,?,?,?,1,1,1,1,1,1,?)`,
      [
        pid,
        userId,
        fol.name,
        fol.slug,
        fol.description,
        fol.headline,
        fol.bio,
        fol.theme_slug,
        fol.is_public,
        fol.is_default,
        portfolioIds.length,
      ],
    );
    portfolioIds.push(pid);

    for (const i of fol.skillIndexes) {
      run(db, "INSERT INTO portfolio_skills (portfolio_id, skill_id) VALUES (?,?)", [
        pid,
        skillIds[i],
      ]);
    }
    for (const i of fol.projectIndexes) {
      run(db, "INSERT INTO portfolio_projects (portfolio_id, project_id) VALUES (?,?)", [
        pid,
        projectIds[i],
      ]);
    }
    for (const i of fol.experienceIndexes) {
      run(db, "INSERT INTO portfolio_experience (portfolio_id, experience_id) VALUES (?,?)", [
        pid,
        experienceIds[i],
      ]);
    }
    for (const i of fol.educationIndexes) {
      run(db, "INSERT INTO portfolio_education (portfolio_id, education_id) VALUES (?,?)", [
        pid,
        educationIds[i],
      ]);
    }
    for (const i of fol.certificationIndexes) {
      run(db, "INSERT INTO portfolio_certifications (portfolio_id, certification_id) VALUES (?,?)", [
        pid,
        certificationIds[i],
      ]);
    }
    for (const i of fol.languageIndexes) {
      run(db, "INSERT INTO portfolio_languages (portfolio_id, language_id) VALUES (?,?)", [
        pid,
        languageIds[i],
      ]);
    }
  }

  if (data.resume && portfolioIds[data.resume.portfolioIndex]) {
    const existing = queryOne(db, "SELECT id FROM resumes WHERE user_id = ?", [userId]);
    if (!existing || force) {
      if (existing) run(db, "DELETE FROM resumes WHERE user_id = ?", [userId]);
      const token = createHash("sha256").update(`${userId}-resume`).digest("hex").slice(0, 16);
      run(
        db,
        `INSERT INTO resumes (id, portfolio_id, user_id, name, theme_slug, is_public, share_token)
         VALUES (?,?,?,?,?,1,?)`,
        [
          id(),
          portfolioIds[data.resume.portfolioIndex],
          userId,
          data.resume.name,
          data.resume.theme_slug,
          token,
        ],
      );
    }
  }
}

const adminBundle: SeedBundle = {
  profile: {
    name: "Admin Dev",
    headline: "Full-stack engineer · India",
    bio: "Building Foliyo and other open-source tools. Prefer simple systems that ship.",
    location: "Bengaluru, India",
    email: "hello@admin.dev",
    website: "https://foliyo.dev",
    github: "foliyo-dev",
    linkedin: "foliyo",
    twitter: "foliyo",
  },
  skills: [
    { name: "TypeScript", level: "expert", category: "languages" },
    { name: "Go", level: "advanced", category: "languages" },
    { name: "Node.js", level: "expert", category: "backend" },
    { name: "SvelteKit", level: "advanced", category: "frontend" },
    { name: "PostgreSQL", level: "advanced", category: "data" },
    { name: "SQLite", level: "expert", category: "data" },
  ],
  projects: [
    {
      title: "Foliyo",
      description: "Open-source portfolio + resume platform with a shared content library.",
      url: "https://foliyo.dev",
      repo_url: "https://github.com/foliyo-dev/foliyo",
      tags: '["typescript","svelte","hono"]',
      featured: 1,
    },
    {
      title: "pqpm",
      description: "Process manager experiments for self-hosted Node apps.",
      url: "",
      repo_url: "https://github.com/example/pqpm",
      tags: '["go","ops"]',
      featured: 0,
    },
  ],
  experience: [
    {
      company: "Foliyo",
      role: "Founder / Engineer",
      location: "Remote",
      start_date: "2025-01",
      end_date: null,
      description: "Product, API, and dashboard for hosted + self-host Foliyo.",
    },
    {
      company: "Acme Soft",
      role: "Senior Backend Engineer",
      location: "Bengaluru",
      start_date: "2021-03",
      end_date: "2024-12",
      description: "APIs, billing, and developer tooling for B2B SaaS.",
    },
  ],
  education: [
    {
      institution: "VTU",
      degree: "B.E.",
      field: "Computer Science",
      start_date: "2015",
      end_date: "2019",
    },
  ],
  certifications: [
    {
      name: "AWS Solutions Architect Associate",
      issuer: "Amazon Web Services",
      credential_url: "https://aws.amazon.com/certification/",
      issued_at: "2023-06",
    },
  ],
  languages: [
    { name: "English", proficiency: "fluent" },
    { name: "Hindi", proficiency: "native" },
    { name: "Kannada", proficiency: "conversational" },
  ],
  portfolios: [
    {
      name: "Main portfolio",
      slug: "main",
      description: "Default public profile for hiring and OSS.",
      headline: "Full-stack engineer building India-first tools",
      bio: "I care about self-hostable software and clear resumes.",
      theme_slug: "minimal",
      is_public: 1,
      is_default: 1,
      skillIndexes: [0, 1, 2, 3, 4, 5],
      projectIndexes: [0, 1],
      experienceIndexes: [0, 1],
      educationIndexes: [0],
      certificationIndexes: [0],
      languageIndexes: [0, 1, 2],
    },
  ],
  resume: { name: "Software Engineer — 2026", theme_slug: "classic", portfolioIndex: 0 },
};

const priyaBundle: SeedBundle = {
  profile: {
    name: "Priya Sharma",
    headline: "Backend engineer · Distributed systems",
    bio: "APIs, Postgres, and reliable jobs. Previously fintech in Mumbai.",
    location: "Mumbai, India",
    email: "priya@example.com",
    website: "https://priya.dev",
    github: "priya-sharma",
    linkedin: "priyasharma",
    twitter: "priyacodes",
  },
  skills: [
    { name: "Go", level: "expert", category: "languages" },
    { name: "PostgreSQL", level: "expert", category: "data" },
    { name: "Kafka", level: "advanced", category: "backend" },
    { name: "Kubernetes", level: "intermediate", category: "ops" },
    { name: "React", level: "intermediate", category: "frontend" },
  ],
  projects: [
    {
      title: "Ledger Lite",
      description: "Double-entry bookkeeping API used by two fintech pilots.",
      url: "https://example.com/ledger",
      repo_url: "https://github.com/example/ledger-lite",
      tags: '["go","postgres"]',
      featured: 1,
    },
    {
      title: "mesh-queue",
      description: "Small job queue library for Node 22 + SQLite.",
      url: "",
      repo_url: "https://github.com/example/mesh-queue",
      tags: '["typescript","sqlite"]',
      featured: 1,
    },
    {
      title: "Campus clubs site",
      description: "Volunteer college clubs directory (archived).",
      url: "",
      repo_url: "",
      tags: '["php"]',
      featured: 0,
    },
  ],
  experience: [
    {
      company: "PayStack India",
      role: "Staff Backend Engineer",
      location: "Mumbai",
      start_date: "2022-08",
      end_date: null,
      description: "Payments ledger, reconciliation jobs, on-call.",
    },
    {
      company: "StartupXYZ",
      role: "Backend Engineer",
      location: "Pune",
      start_date: "2019-06",
      end_date: "2022-07",
      description: "REST APIs and data pipelines.",
    },
  ],
  education: [
    {
      institution: "IIT Bombay",
      degree: "B.Tech",
      field: "Computer Science",
      start_date: "2015",
      end_date: "2019",
    },
  ],
  certifications: [
    {
      name: "CKA",
      issuer: "CNCF",
      credential_url: "https://www.cncf.io/certification/cka/",
      issued_at: "2024-02",
    },
  ],
  languages: [
    { name: "English", proficiency: "fluent" },
    { name: "Hindi", proficiency: "native" },
    { name: "Marathi", proficiency: "native" },
  ],
  portfolios: [
    {
      name: "Hiring folio",
      slug: "main",
      description: "For recruiters — backend focus.",
      headline: "Backend engineer · Fintech & reliability",
      bio: "Looking for staff+ roles in payments or infrastructure.",
      theme_slug: "modern",
      is_public: 1,
      is_default: 1,
      skillIndexes: [0, 1, 2, 3],
      projectIndexes: [0, 1],
      experienceIndexes: [0, 1],
      educationIndexes: [0],
      certificationIndexes: [0],
      languageIndexes: [0, 1, 2],
    },
    {
      name: "Open source",
      slug: "opensource",
      description: "OSS and side projects only.",
      headline: "Open-source maintainer",
      bio: "Libraries and tools I ship outside work.",
      theme_slug: "creative",
      is_public: 1,
      is_default: 0,
      skillIndexes: [0, 1, 4],
      projectIndexes: [1, 2],
      experienceIndexes: [],
      educationIndexes: [0],
      certificationIndexes: [],
      languageIndexes: [0, 1],
    },
  ],
  resume: { name: "Priya Sharma — Backend", theme_slug: "compact", portfolioIndex: 0 },
};

const arjunBundle: SeedBundle = {
  profile: {
    name: "Arjun Mehta",
    headline: "Product designer · Design systems",
    bio: "Interfaces for developer tools. Previously design at a D2C brand.",
    location: "Delhi, India",
    email: "arjun@example.com",
    website: "https://arjun.design",
    github: "arjunmehta",
    linkedin: "arjunmehta",
    twitter: "arjundsgn",
  },
  skills: [
    { name: "Figma", level: "expert", category: "design" },
    { name: "Design systems", level: "advanced", category: "design" },
    { name: "HTML/CSS", level: "advanced", category: "frontend" },
    { name: "User research", level: "intermediate", category: "product" },
  ],
  projects: [
    {
      title: "Foliyo brand concepts",
      description: "Logo and landing explorations for Foliyo.",
      url: "https://foliyo.dev",
      repo_url: "",
      tags: '["brand","figma"]',
      featured: 1,
    },
    {
      title: "Checkout redesign",
      description: "Reduced drop-off 18% for a D2C checkout flow.",
      url: "",
      repo_url: "",
      tags: '["ux","conversion"]',
      featured: 1,
    },
  ],
  experience: [
    {
      company: "Studio North",
      role: "Product Designer",
      location: "Delhi",
      start_date: "2021-01",
      end_date: null,
      description: "Design systems and marketing sites for SaaS clients.",
    },
  ],
  education: [
    {
      institution: "NID",
      degree: "B.Des",
      field: "Communication Design",
      start_date: "2016",
      end_date: "2020",
    },
  ],
  certifications: [],
  languages: [
    { name: "English", proficiency: "fluent" },
    { name: "Hindi", proficiency: "native" },
  ],
  portfolios: [
    {
      name: "Design folio",
      slug: "main",
      description: "Selected product and brand work.",
      headline: "Product designer for developer tools",
      bio: "I design calm interfaces that respect attention.",
      theme_slug: "creative",
      is_public: 1,
      is_default: 1,
      skillIndexes: [0, 1, 2, 3],
      projectIndexes: [0, 1],
      experienceIndexes: [0],
      educationIndexes: [0],
      certificationIndexes: [],
      languageIndexes: [0, 1],
    },
  ],
  resume: { name: "Arjun Mehta — Designer", theme_slug: "classic", portfolioIndex: 0 },
};

function main(): void {
  const config = loadConfig();
  const db = openDatabase(config);
  runMigrations(db);

  console.log(`Seeding demo data (force=${force}) into ${config.dbPath}`);

  const adminEmail = config.adminEmail || "admin@localhost";
  const adminId = ensureUser(db, {
    email: adminEmail,
    handle: "admin",
    plan: "free",
    name: "Admin Dev",
    password: config.adminPassword || DEMO_PASSWORD,
  });
  console.log(`→ ${adminEmail} / handle=admin`);
  seedLibrary(db, adminId, adminEmail, adminBundle);

  const priyaId = ensureUser(db, {
    email: "priya@demo.foliyo",
    handle: "priya",
    plan: "pro",
    name: "Priya Sharma",
  });
  console.log(`→ priya@demo.foliyo / handle=priya (pro, 2 portfolios)`);
  seedLibrary(db, priyaId, "priya@demo.foliyo", priyaBundle);

  const arjunId = ensureUser(db, {
    email: "arjun@demo.foliyo",
    handle: "arjun",
    plan: "free",
    name: "Arjun Mehta",
  });
  console.log(`→ arjun@demo.foliyo / handle=arjun (free, design folio)`);
  seedLibrary(db, arjunId, "arjun@demo.foliyo", arjunBundle);

  ensureHandles(db);

  console.log(`
Done. Log in at the dashboard (password: ${DEMO_PASSWORD}):
  ${adminEmail}          → http://localhost:8080/u/admin
  priya@demo.foliyo      → http://localhost:8080/u/priya
                           http://localhost:8080/u/priya/opensource
  arjun@demo.foliyo      → http://localhost:8080/u/arjun

Re-run with --force to wipe & recreate library data for these users.
`);
}

main();
