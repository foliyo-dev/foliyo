import { api, type BulkResult } from './client';

export type LanguageProficiency = 'native' | 'fluent' | 'conversational' | 'basic';

export type Language = {
	id: string;
	name: string;
	proficiency: LanguageProficiency;
	sort_order: number;
};

export const languageProficiencies: LanguageProficiency[] = [
	'native',
	'fluent',
	'conversational',
	'basic'
];

export const listLanguages = () => api<Language[]>('/languages');
export const createLanguage = (data: Partial<Language>) =>
	api<Language[]>('/languages', { method: 'POST', body: JSON.stringify(data) });
export const bulkCreateLanguages = (items: Partial<Language>[]) =>
	api<BulkResult<Language>>('/languages/bulk', { method: 'POST', body: JSON.stringify({ items }) });
export const updateLanguage = (id: string, data: Partial<Language>) =>
	api<{ ok: boolean }>(`/languages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLanguage = (id: string) => api<void>(`/languages/${id}`, { method: 'DELETE' });
export const listDeletedLanguages = () => api<Language[]>(`/languages/deleted`);
export const restoreLanguage = (id: string) =>
	api<{ ok: boolean }>(`/languages/${id}/restore`, { method: 'POST', body: '{}' });
export const purgeLanguage = (id: string) =>
	api<void>(`/languages/${id}/purge`, { method: 'DELETE' });
