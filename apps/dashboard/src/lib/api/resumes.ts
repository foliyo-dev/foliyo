import { api } from './client';
import { corePublicUrl } from './portfolios';

export type Resume = {
	id: string;
	portfolio_id: string;
	name: string;
	theme_slug: string;
	is_public: number;
	share_token: string;
	view_count: number;
};

export const listResumes = () => api<Resume[]>('/resumes');
export const createResume = (data: Partial<Resume>) =>
	api<Resume[]>('/resumes', { method: 'POST', body: JSON.stringify(data) });
export const updateResume = (id: string, data: Partial<Resume>) =>
	api<{ ok: boolean }>(`/resumes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteResume = (id: string) => api<void>(`/resumes/${id}`, { method: 'DELETE' });
export const regenerateResumeToken = (id: string) =>
	api<{ share_token: string }>(`/resumes/${id}/regenerate-token`, { method: 'POST' });

export const resumeThemes = ['classic', 'compact', 'academic'] as const;

export function resumeShareUrl(shareToken: string): string {
	return corePublicUrl(`/r/${shareToken}`);
}
