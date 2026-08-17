import { api } from './client';

export type ClearContentCounts = {
	resumes: number;
	portfolios: number;
	skills: number;
	projects: number;
	experience: number;
	education: number;
	certifications: number;
	languages: number;
	social_links: number;
	applications: number;
	blog_posts: number;
	job_analyses?: number;
};

export type Settings = {
	site_title: string;
	site_description: string;
	theme_slug: string;
	resume_theme: string;
	custom_domain: string;
	seo_keywords: string;
};

export const getSettings = () => api<Settings>('/settings');

export const updateSettings = (data: Partial<Settings>) =>
	api<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) });

/** Wipe library/resumes/portfolios. Keeps login + email_verified. Confirm must be CLEAR. */
export const clearAllContent = () =>
	api<{ ok: true; deleted: ClearContentCounts }>('/settings/clear-content', {
		method: 'POST',
		body: JSON.stringify({ confirm: 'CLEAR' })
	});
