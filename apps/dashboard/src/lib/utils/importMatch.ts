/**
 * Stable identity keys so resume import can skip rows already in the library.
 * Keep in sync with apps/core/src/import/match.ts
 */

export function normText(s: string | null | undefined): string {
	return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** YYYY or YYYY-MM from a resume date; empty when missing. */
export function normDate(s: string | null | undefined): string {
	const t = (s ?? '').trim();
	const m = t.match(/^(\d{4}(?:-\d{2})?)/);
	return m ? m[1]! : '';
}

/** Host + path, no scheme / www / trailing slash — so github.com/x matches https://github.com/x/. */
export function normUrl(s: string | null | undefined): string {
	const v = (s ?? '').trim().toLowerCase().replace(/\/+$/, '');
	if (!v) return '';
	return v.replace(/^https?:\/\//, '').replace(/^www\./, '');
}

export function skillKey(name: string): string {
	return `skill:${normText(name)}`;
}

export function experienceKey(
	company: string,
	role: string,
	start: string | null | undefined
): string {
	return `exp:${normText(company)}|${normText(role)}|${normDate(start)}`;
}

export function educationKey(
	institution: string,
	degree: string | null | undefined
): string {
	return `edu:${normText(institution)}|${normText(degree)}`;
}

export function projectKey(
	title: string,
	url: string | null | undefined,
	repoUrl: string | null | undefined
): string {
	const u = normUrl(url) || normUrl(repoUrl);
	if (u) return `proj:url:${u}`;
	return `proj:title:${normText(title)}`;
}

export function certificationKey(
	name: string,
	issuer: string | null | undefined
): string {
	return `cert:${normText(name)}|${normText(issuer)}`;
}

export function languageKey(name: string): string {
	return `lang:${normText(name)}`;
}

/**
 * One link can be stored as a handle or a URL. Any of these identities matching
 * an existing row counts as the same link.
 */
export function linkIdentities(provider: string, value: string): string[] {
	const p = normText(provider);
	const raw = (value ?? '').trim().toLowerCase().replace(/\/+$/, '');
	if (!p || !raw) return [];
	const ids = new Set<string>([`${p}|${raw}`]);
	const hostPath = normUrl(raw);
	if (hostPath) ids.add(`${p}|${hostPath}`);
	const last = hostPath.split('/').filter(Boolean).pop();
	if (last) ids.add(`${p}|${last.replace(/^@/, '')}`);
	return [...ids];
}

export function linkMatchesExisting(
	existing: Set<string>,
	provider: string,
	value: string
): boolean {
	return linkIdentities(provider, value).some((id) => existing.has(id));
}

export function rememberLink(existing: Set<string>, provider: string, value: string): void {
	for (const id of linkIdentities(provider, value)) existing.add(id);
}

export type ImportLibraryIndex = {
	skills: Set<string>;
	experience: Set<string>;
	education: Set<string>;
	projects: Set<string>;
	certifications: Set<string>;
	languages: Set<string>;
	links: Set<string>;
};

export function emptyLibraryIndex(): ImportLibraryIndex {
	return {
		skills: new Set(),
		experience: new Set(),
		education: new Set(),
		projects: new Set(),
		certifications: new Set(),
		languages: new Set(),
		links: new Set()
	};
}

export type ImportDupFlags = {
	skills: boolean[];
	experience: boolean[];
	education: boolean[];
	projects: boolean[];
	certifications: boolean[];
	languages: boolean[];
	links: boolean[];
};

export function emptyDupFlags(): ImportDupFlags {
	return {
		skills: [],
		experience: [],
		education: [],
		projects: [],
		certifications: [],
		languages: [],
		links: []
	};
}

export function matchDraftAgainstLibrary(
	draft: {
		candidate: { links: Record<string, string> };
		skills: Array<{ name: string }>;
		experience: Array<{ company: string; role: string; start: string | null }>;
		education: Array<{ institution: string; degree: string | null }>;
		projects: Array<{
			title: string;
			url: string | null;
			repo_url: string | null;
		}>;
		certifications: Array<{ name: string; issuer: string | null }>;
		languages: Array<{ language: string }>;
	},
	index: ImportLibraryIndex
): ImportDupFlags {
	const linkEntries = Object.entries(draft.candidate.links || {});
	return {
		skills: draft.skills.map((s) => index.skills.has(skillKey(s.name))),
		experience: draft.experience.map((e) =>
			index.experience.has(experienceKey(e.company, e.role, e.start))
		),
		education: draft.education.map((e) =>
			index.education.has(educationKey(e.institution, e.degree))
		),
		projects: draft.projects.map((p) =>
			index.projects.has(projectKey(p.title, p.url, p.repo_url))
		),
		certifications: draft.certifications.map((c) =>
			index.certifications.has(certificationKey(c.name, c.issuer))
		),
		languages: draft.languages.map((l) => index.languages.has(languageKey(l.language))),
		links: linkEntries.map(([provider, value]) =>
			linkMatchesExisting(index.links, provider, value)
		)
	};
}

export function dupCount(flags: ImportDupFlags): number {
	return (
		flags.skills.filter(Boolean).length +
		flags.experience.filter(Boolean).length +
		flags.education.filter(Boolean).length +
		flags.projects.filter(Boolean).length +
		flags.certifications.filter(Boolean).length +
		flags.languages.filter(Boolean).length +
		flags.links.filter(Boolean).length
	);
}
