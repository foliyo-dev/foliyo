import { api } from './client';

export type Settings = {
	id?: string;
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

export const portfolioThemes = ['minimal', 'modern', 'creative'] as const;
export const resumeThemes = ['classic', 'compact', 'academic'] as const;
