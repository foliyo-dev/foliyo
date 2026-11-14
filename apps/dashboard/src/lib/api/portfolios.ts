import { siteUrl } from '$lib/config';
import { api, ApiError } from './client';

import type { ThemeConfig, ThemeRecipe } from './ai';

export type Portfolio = {
	id: string;
	name: string;
	slug: string;
	description: string;
	headline: string;
	bio: string;
	theme_slug: string;
	/** JSON string or parsed ThemeConfig from API */
	theme_config?: ThemeConfig | string | null;
	is_public: number;
	is_default: number;
	show_skills: number;
	show_projects: number;
	show_experience: number;
	show_education: number;
	show_certifications: number;
	show_languages: number;
	show_posts?: number;
	show_skill_levels?: number;
	projects_layout?: 'cards' | 'featured_timeline' | 'timeline';
	hero_cta_primary?: string;
	hero_cta_secondary?: string;
	skills_title: string;
	projects_title: string;
	experience_title: string;
	education_title: string;
	certifications_title: string;
	languages_title: string;
	posts_title?: string;
	sort_order: number;
	resume_id: string | null;
	access_token: string | null;
};

export const projectsLayoutOptions = [
	{ id: 'cards' as const, label: 'Cards', hint: 'Classic project cards' },
	{
		id: 'featured_timeline' as const,
		label: 'Featured + timeline',
		hint: 'Featured cards, then build-log timeline'
	},
	{ id: 'timeline' as const, label: 'Timeline', hint: 'Chronological build log only' }
];

export type { ThemeConfig, ThemeRecipe };

export const portfolioLayouts = [
	{ id: 'classic' as const, label: 'Classic', hint: 'Existing Foliyo skins' },
	{ id: 'photo-hero' as const, label: 'Photo hero', hint: 'Cinematic photography layout' },
	{ id: 'gallery-grid' as const, label: 'Gallery grid', hint: 'Minimal image gallery' },
	{ id: 'glassmorphic' as const, label: 'Glassmorphic', hint: 'Frosted glass panels' }
];

export function parsePortfolioThemeConfig(
	raw: ThemeConfig | string | null | undefined
): ThemeConfig | null {
	if (raw == null || raw === '') return null;
	if (typeof raw === 'object') return raw;
	try {
		return JSON.parse(raw) as ThemeConfig;
	} catch {
		return null;
	}
}

export type PortfolioContent = {
	skill_ids: string[];
	project_ids: string[];
	experience_ids: string[];
	education_ids: string[];
	certification_ids: string[];
	language_ids: string[];
	post_ids?: string[];
};

export type PortfolioDetail = Portfolio & { content: PortfolioContent };

export const FREE_PORTFOLIO_LIMIT = 1;

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.slice(0, 80);
}

export function isProPlan(plan: string | null | undefined): boolean {
	const p = (plan ?? 'free').toLowerCase();
	return p === 'pro' || p === 'lifetime' || p === 'selfhost';
}

export function parseApiError(err: unknown): { message: string; upgrade?: boolean; code?: string } {
	if (!(err instanceof ApiError)) {
		return { message: err instanceof Error ? err.message : 'Request failed' };
	}
	try {
		const body = JSON.parse(err.message) as {
			error?: string;
			message?: string;
			upgrade?: boolean;
		};
		return {
			message: body.message || body.error || err.message,
			upgrade: body.upgrade,
			code: body.error
		};
	} catch {
		return { message: err.message };
	}
}

export const listPortfolios = () => api<Portfolio[]>('/portfolios');
export const getPortfolio = (id: string) => api<PortfolioDetail>(`/portfolios/${id}`);
export const createPortfolio = (data: Partial<Portfolio>) =>
	api<Portfolio[]>('/portfolios', { method: 'POST', body: JSON.stringify(data) });
export const updatePortfolio = (id: string, data: Partial<Portfolio>) =>
	api<{ ok: boolean }>(`/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePortfolio = (id: string) =>
	api<void>(`/portfolios/${id}`, { method: 'DELETE' });
export const setDefaultPortfolio = (id: string) =>
	api<{ ok: boolean }>(`/portfolios/${id}/default`, { method: 'PUT' });
export const updatePortfolioContent = (id: string, content: PortfolioContent) =>
	api<{ ok: boolean }>(`/portfolios/${id}/content`, {
		method: 'PUT',
		body: JSON.stringify(content)
	});
export const generatePortfolioAccessToken = (id: string) =>
	api<{ access_token: string }>(`/portfolios/${id}/access-token`, { method: 'POST' });
export const revokePortfolioAccessToken = (id: string) =>
	api<{ ok: boolean }>(`/portfolios/${id}/access-token`, { method: 'DELETE' });

export const portfolioThemes = [
	'minimal',
	'modern',
	'creative',
	'noir',
	'atelier',
	'editorial'
] as const;

/** Public origin for /u /r /p links. Prefers runtime siteUrl (FOLIYO_SITE_URL via /api/public-config). */
export function corePublicUrl(path = ''): string {
	if (siteUrl) return `${siteUrl}${path}`;
	if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
	const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
	const base = apiUrl.replace(/\/api\/?$/, '');
	return `${base}${path}`;
}

export function portfolioPublicUrl(
	handle: string | null | undefined,
	p: { slug: string; is_public: number; is_default: number }
): string {
	if (!p.is_public) return 'Private — not publicly accessible';
	if (handle) {
		if (p.is_default) return corePublicUrl(`/u/${handle}`);
		return corePublicUrl(`/u/${handle}/${p.slug}`);
	}
	if (p.is_default) return corePublicUrl('/');
	return corePublicUrl(`/${p.slug}`);
}

/** Unlisted link — works even when the portfolio is private, as long as the token matches. */
export function portfolioPrivateUrl(accessToken: string): string {
	return corePublicUrl(`/p/${accessToken}`);
}
