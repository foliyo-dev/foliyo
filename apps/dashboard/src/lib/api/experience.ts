import { api } from './client';

export type Experience = {
	id: string;
	company: string;
	role: string;
	location: string;
	start_date: string;
	end_date: string | null;
	description: string;
	article_url: string;
	skills_developed: string;
	sort_order: number;
};

export const listExperience = () => api<Experience[]>('/experience');
export const createExperience = (data: Partial<Experience>) =>
	api<Experience[]>('/experience', { method: 'POST', body: JSON.stringify(data) });
export const updateExperience = (id: string, data: Partial<Experience>) =>
	api<{ ok: boolean }>(`/experience/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteExperience = (id: string) =>
	api<void>(`/experience/${id}`, { method: 'DELETE' });
