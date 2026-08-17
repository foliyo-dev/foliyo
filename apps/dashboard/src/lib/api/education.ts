import { api, type BulkResult } from './client';

export type Education = {
	id: string;
	institution: string;
	degree: string;
	field: string;
	start_date: string;
	end_date: string | null;
	description: string;
	skills_developed: string;
	sort_order: number;
};

export const listEducation = () => api<Education[]>('/education');
export const createEducation = (data: Partial<Education>) =>
	api<Education[]>('/education', { method: 'POST', body: JSON.stringify(data) });
export const bulkCreateEducation = (items: Partial<Education>[]) =>
	api<BulkResult<Education>>('/education/bulk', { method: 'POST', body: JSON.stringify({ items }) });
export const updateEducation = (id: string, data: Partial<Education>) =>
	api<{ ok: boolean }>(`/education/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const reorderEducation = (ids: string[]) =>
	api<{ ok: boolean }>('/education/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
export const deleteEducation = (id: string) =>
	api<void>(`/education/${id}`, { method: 'DELETE' });
export const listDeletedEducation = () => api<Education[]>(`/education/deleted`);
export const restoreEducation = (id: string) =>
	api<{ ok: boolean }>(`/education/${id}/restore`, { method: 'POST', body: '{}' });
export const purgeEducation = (id: string) =>
	api<void>(`/education/${id}/purge`, { method: 'DELETE' });
