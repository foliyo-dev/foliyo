/**
 * Tiny alias map — not a global skills catalog.
 * Exact match after normalizing; related tech (Docker vs Kubernetes) stays unmatched.
 */

const ALIAS_TO_CANONICAL: Record<string, string> = {
  k8s: "kubernetes",
  "kubernetes engine": "kubernetes",
  gke: "kubernetes",
  eks: "kubernetes",
  aks: "kubernetes",
  nodejs: "node.js",
  "node.js": "node.js",
  "node js": "node.js",
  golang: "go",
  postgres: "postgresql",
  postgresql: "postgresql",
  tf: "terraform",
  k8: "kubernetes",
  reactjs: "react",
  "react.js": "react",
  vuejs: "vue",
  "vue.js": "vue",
  nextjs: "next.js",
  "next js": "next.js",
  nuxtjs: "nuxt",
  ts: "typescript",
  js: "javascript",
  gcp: "gcp",
  "google cloud": "gcp",
  "google cloud platform": "gcp",
  "amazon web services": "aws",
  "ms azure": "azure",
  mongodb: "mongodb",
  mongo: "mongodb",
  psql: "postgresql",
  "c#": "c#",
  csharp: "c#",
  "c++": "c++",
  cpp: "c++",
  "ci/cd": "ci/cd",
  cicd: "ci/cd",
  "github actions": "github actions",
  gh: "github",
  "rest api": "rest",
  restful: "rest",
  graphql: "graphql",
  gql: "graphql",
  postgresl: "postgresql",
  kafka: "kafka",
  "apache kafka": "kafka",
  redis: "redis",
  docker: "docker",
  kubernetes: "kubernetes",
  terraform: "terraform",
  python: "python",
  java: "java",
  rust: "rust",
  ruby: "ruby",
  rails: "ruby on rails",
  "ruby on rails": "ruby on rails",
  php: "php",
  laravel: "laravel",
  swift: "swift",
  kotlin: "kotlin",
  flutter: "flutter",
  dart: "dart",
  figma: "figma",
  pytorch: "pytorch",
  tensorflow: "tensorflow",
  spark: "spark",
  "apache spark": "spark",
  elasticsearch: "elasticsearch",
  elastic: "elasticsearch",
  mysql: "mysql",
  sqlite: "sqlite",
  django: "django",
  flask: "flask",
  fastapi: "fastapi",
  spring: "spring",
  "spring boot": "spring boot",
  angular: "angular",
  svelte: "svelte",
  sveltekit: "sveltekit",
  webpack: "webpack",
  vite: "vite",
  linux: "linux",
  git: "git",
  jira: "jira",
  ansible: "ansible",
  pulumi: "pulumi",
  helm: "helm",
  prometheus: "prometheus",
  grafana: "grafana",
  datadog: "datadog",
  snowflake: "snowflake",
  airflow: "airflow",
  "apache airflow": "airflow",
  pandas: "pandas",
  numpy: "numpy",
  scikit: "scikit-learn",
  "scikit-learn": "scikit-learn",
  huggingface: "hugging face",
  "hugging face": "hugging face",
  openai: "openai",
  langchain: "langchain",
};

/** Catalog tokens we look for in a JD even when they are not in the user's library. */
export const CATALOG_SKILLS: string[] = [
  ...new Set([
    ...Object.values(ALIAS_TO_CANONICAL),
    "typescript",
    "javascript",
    "python",
    "java",
    "go",
    "rust",
    "react",
    "next.js",
    "node.js",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "aws",
    "gcp",
    "azure",
    "kubernetes",
    "docker",
    "graphql",
    "rest",
    "kafka",
    "spark",
    "tensorflow",
    "pytorch",
    "figma",
    "swift",
    "kotlin",
    "terraform",
    "microservices",
    "ci/cd",
    "linux",
    "git",
  ]),
];

const DISPLAY: Record<string, string> = {
  kubernetes: "Kubernetes",
  "node.js": "Node.js",
  go: "Go",
  postgresql: "PostgreSQL",
  typescript: "TypeScript",
  javascript: "JavaScript",
  "next.js": "Next.js",
  gcp: "GCP",
  aws: "AWS",
  azure: "Azure",
  "c#": "C#",
  "c++": "C++",
  "ci/cd": "CI/CD",
  graphql: "GraphQL",
  mongodb: "MongoDB",
  mysql: "MySQL",
  redis: "Redis",
  kafka: "Kafka",
  docker: "Docker",
  terraform: "Terraform",
  python: "Python",
  java: "Java",
  rust: "Rust",
  react: "React",
  rest: "REST",
  microservices: "Microservices",
  "github actions": "GitHub Actions",
  "ruby on rails": "Ruby on Rails",
  "spring boot": "Spring Boot",
  "scikit-learn": "scikit-learn",
  "hugging face": "Hugging Face",
  openai: "OpenAI",
};

export function normKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Collapse aliases ("K8s") to a canonical key ("kubernetes"). */
export function normalizeSkillKey(name: string): string {
  const key = normKey(name);
  if (!key) return "";
  return ALIAS_TO_CANONICAL[key] ?? key;
}

export function displaySkillName(canonicalOrName: string): string {
  const key = normalizeSkillKey(canonicalOrName);
  if (DISPLAY[key]) return DISPLAY[key];
  const raw = canonicalOrName.trim();
  if (!raw) return raw;
  if (raw === raw.toLowerCase() || raw === raw.toUpperCase()) {
    return raw
      .split(/[\s/_-]+/)
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
  }
  return raw;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary search that still matches tokens with `.` (Node.js). */
export function skillMentionRegex(term: string): RegExp {
  const t = term.trim();
  if (!t) return /(?!)/;
  const escaped = escapeRegex(t).replace(/\\\./g, "\\.");
  return new RegExp(`(?:^|[^A-Za-z0-9+])${escaped}(?:[^A-Za-z0-9+]|$)`, "i");
}

export function mentionedIn(text: string, term: string): boolean {
  if (!term.trim()) return false;
  return skillMentionRegex(term).test(text);
}

/** All strings that should count as a mention of this canonical skill. */
export function mentionTermsFor(canonical: string): string[] {
  const key = normalizeSkillKey(canonical);
  const terms = new Set<string>([key, displaySkillName(key)]);
  for (const [alias, target] of Object.entries(ALIAS_TO_CANONICAL)) {
    if (target === key) terms.add(alias);
  }
  return [...terms];
}
