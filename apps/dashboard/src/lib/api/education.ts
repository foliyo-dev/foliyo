import { api } from './client';

export type Education = {
	id: string;
	institution: string;
	degree: string;
	field: string;
	start_date: string;
	end_date: string | null;
	description: string;
	sort_order: number;
};

export const listEducation = () => api<Education[]>('/education');
export const createEducation = (data: Partial<Education>) =>
	api<Education[]>('/education', { method: 'POST', body: JSON.stringify(data) });
export const updateEducation = (id: string, data: Partial<Education>) =>
	api<{ ok: boolean }>(`/education/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteEducation = (id: string) =>
	api<void>(`/education/${id}`, { method: 'DELETE' });
