import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';
import { ApiError } from './client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

/** Fetch rendered library preview HTML (auth required). */
export async function fetchLibraryPreviewHtml(theme?: string): Promise<string> {
	const token = get(accessToken);
	const qs = theme ? `?theme=${encodeURIComponent(theme)}` : '';
	const res = await fetch(`${API_BASE}/preview/library${qs}`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	return res.text();
}

/** Fetch private portfolio preview HTML for a saved folio (owner, all plans). */
export async function fetchPortfolioPreviewHtml(portfolioId: string): Promise<string> {
	const token = get(accessToken);
	const res = await fetch(`${API_BASE}/preview/portfolio/${encodeURIComponent(portfolioId)}`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	return res.text();
}

export type PortfolioDraftPreview = {
	name?: string;
	description?: string;
	headline?: string;
	bio?: string;
	theme_slug?: string;
	show_skills?: number;
	show_projects?: number;
	show_experience?: number;
	show_education?: number;
	show_certifications?: number;
	show_languages?: number;
	skills_title?: string;
	projects_title?: string;
	experience_title?: string;
	education_title?: string;
	certifications_title?: string;
	languages_title?: string;
	skill_ids?: string[];
	project_ids?: string[];
	experience_ids?: string[];
	education_ids?: string[];
	certification_ids?: string[];
	language_ids?: string[];
};

/** Render unsaved portfolio form state as HTML (owner, all plans). */
export async function fetchPortfolioDraftPreviewHtml(
	draft: PortfolioDraftPreview
): Promise<string> {
	const token = get(accessToken);
	const res = await fetch(`${API_BASE}/preview/portfolio/draft`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify(draft)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	return res.text();
}

export type ResumeDraftPreview = {
	headline?: string;
	bio?: string;
	theme_slug?: string;
};

/** Fetch private resume preview HTML for the logged-in owner (all plans). */
export async function fetchResumePreviewHtml(resumeId: string): Promise<string> {
	const token = get(accessToken);
	const res = await fetch(`${API_BASE}/preview/resume/${encodeURIComponent(resumeId)}`, {
		cache: 'no-store',
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	return res.text();
}

/** Render unsaved resume summary / theme from the edit form. */
export async function fetchResumeDraftPreviewHtml(
	resumeId: string,
	draft: ResumeDraftPreview
): Promise<string> {
	const token = get(accessToken);
	const res = await fetch(`${API_BASE}/preview/resume/${encodeURIComponent(resumeId)}/draft`, {
		method: 'POST',
		cache: 'no-store',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify(draft)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	return res.text();
}
