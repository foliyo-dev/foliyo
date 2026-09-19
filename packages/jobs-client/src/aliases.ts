/**
 * String helpers + optional SkillCatalog for alias-aware matching.
 * Canonical skill identity lives in DB (`global_skills` / `skill_aliases`).
 * CSV seed loading is Node-only: `@foliyo/jobs-client/seed` (do not import here — browser bundle).
 */

export type SkillCatalog = {
  /** alias / surface key → canonical normalized_key */
  aliasToCanonical: Map<string, string>;
  /** canonical key → mention terms (aliases + display) */
  termsByCanonical: Map<string, string[]>;
  /** canonical keys to scan when extracting JD skills */
  catalogKeys: string[];
  /** canonical key → display name */
  displayByCanonical: Map<string, string>;
};

export type SkillCatalogRow = {
  normalized_key: string;
  canonical_name: string;
  aliases: string[];
};

export function normKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Alphanumeric fold for punctuation-insensitive compare (NodeJS ↔ node.js). */
export function alnumKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9+#]+/g, "");
}

/**
 * String normalize only — does NOT resolve aliases.
 * Alias → canonical resolution belongs in DB / SkillCatalog.
 */
export function normalizeSkillKey(name: string): string {
  return normKey(name);
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
  if (skillMentionRegex(term).test(text)) return true;
  const fold = alnumKey(term);
  if (fold.length < 3) return false;
  const foldedText = text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ");
  return new RegExp(`(?:^|\\s)${escapeRegex(fold)}(?:\\s|$)`).test(foldedText);
}

function titleCase(raw: string): string {
  return raw
    .split(/[\s/_-]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Pretty label when no catalog/DB name is available. */
export function displaySkillName(name: string, catalog?: SkillCatalog): string {
  const key = normalizeSkillKey(name);
  if (catalog) {
    const canonical = resolveCanonicalKey(name, catalog) ?? key;
    const fromCat = catalog.displayByCanonical.get(canonical);
    if (fromCat) return fromCat;
  }
  const raw = name.trim();
  if (!raw) return raw;
  if (raw === raw.toLowerCase() || raw === raw.toUpperCase()) return titleCase(raw);
  return raw;
}

function indexKey(map: Map<string, string>, key: string, canonical: string) {
  if (!key) return;
  if (!map.has(key)) map.set(key, canonical);
  const folded = alnumKey(key);
  if (folded && !map.has(folded)) map.set(folded, canonical);
}

/** Build a runtime catalog from DB rows (or any alias list). */
export function buildSkillCatalog(rows: SkillCatalogRow[]): SkillCatalog {
  const aliasToCanonical = new Map<string, string>();
  const termsByCanonical = new Map<string, string[]>();
  const displayByCanonical = new Map<string, string>();

  for (const row of rows) {
    const canonical = normalizeSkillKey(row.normalized_key) || row.normalized_key;
    if (!canonical) continue;
    displayByCanonical.set(canonical, row.canonical_name || titleCase(canonical));
    const terms = new Set<string>([canonical, row.canonical_name, ...row.aliases]);
    indexKey(aliasToCanonical, canonical, canonical);
    indexKey(aliasToCanonical, normalizeSkillKey(row.canonical_name), canonical);
    for (const alias of row.aliases) {
      indexKey(aliasToCanonical, normalizeSkillKey(alias), canonical);
      indexKey(aliasToCanonical, alias, canonical);
      terms.add(alias);
    }
    termsByCanonical.set(canonical, [...terms].map((t) => t.trim()).filter(Boolean));
  }

  return {
    aliasToCanonical,
    termsByCanonical,
    catalogKeys: [...displayByCanonical.keys()],
    displayByCanonical,
  };
}

export function resolveCanonicalKey(raw: string, catalog: SkillCatalog): string | null {
  const key = normalizeSkillKey(raw);
  if (!key) return null;
  if (catalog.aliasToCanonical.has(key)) return catalog.aliasToCanonical.get(key)!;
  const folded = alnumKey(raw);
  if (folded && catalog.aliasToCanonical.has(folded)) {
    return catalog.aliasToCanonical.get(folded)!;
  }
  return null;
}

/** All strings that should count as a mention of this skill. */
export function mentionTermsFor(skillName: string, catalog?: SkillCatalog): string[] {
  const terms = new Set<string>([skillName.trim(), normalizeSkillKey(skillName)].filter(Boolean));
  if (catalog) {
    const canonical = resolveCanonicalKey(skillName, catalog) ?? normalizeSkillKey(skillName);
    for (const t of catalog.termsByCanonical.get(canonical) ?? []) terms.add(t);
    const display = catalog.displayByCanonical.get(canonical);
    if (display) terms.add(display);
  } else {
    terms.add(displaySkillName(skillName));
  }
  return [...terms];
}

/**
 * JD surface form for ATS: longest alias term that appears in the JD.
 */
export function atsLabelFromJd(
  jdText: string,
  skillName: string,
  catalog?: SkillCatalog,
): string | null {
  const terms = mentionTermsFor(skillName, catalog).sort((a, b) => b.length - a.length);
  for (const term of terms) {
    if (!mentionedIn(jdText, term)) continue;
    const idx = jdText.toLowerCase().indexOf(term.toLowerCase());
    if (idx >= 0) return jdText.slice(idx, idx + term.length);
    // Alnum-only hit (NodeJS vs Node.js): return the JD token that folds equal.
    const fold = alnumKey(term);
    const re = /[A-Za-z0-9+#]+(?:[./][A-Za-z0-9+#]+)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(jdText))) {
      if (alnumKey(m[0]) === fold) return m[0];
    }
  }
  return null;
}

/** Match library skills mentioned in JD text (alias-aware when catalog provided). */
export function matchSkillsFromJd(
  jdText: string,
  skills: Array<{ id: string; name: string }>,
  catalog?: SkillCatalog,
): string[] {
  const matched: string[] = [];
  for (const skill of skills) {
    const name = skill.name.trim();
    if (!name) continue;
    const hit = mentionTermsFor(name, catalog).some((term) => mentionedIn(jdText, term));
    if (hit) matched.push(skill.id);
  }
  return matched;
}
