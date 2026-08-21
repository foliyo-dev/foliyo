import { api } from './client';
import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';
import { corePublicUrl } from './portfolios';

export type Resume = {
	id: string;
	portfolio_id: string | null;
	name: string;
	theme_slug: string;
	is_public: number;
	share_token: string;
	view_count: number;
	headline?: string;
	bio?: string;
};

export type ResumeContent = {
	skill_ids: string[];
	project_ids: string[];
	experience_ids: string[];
	education_ids: string[];
	certification_ids: string[];
	language_ids: string[];
};

export const listResumes = () => api<Resume[]>('/resumes');
export const createResume = (data: Partial<Resume> & { content?: ResumeContent }) =>
	api<Resume[]>('/resumes', { method: 'POST', body: JSON.stringify(data) });
export const updateResume = (id: string, data: Partial<Resume>) =>
	api<{ ok: boolean }>(`/resumes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteResume = (id: string) => api<void>(`/resumes/${id}`, { method: 'DELETE' });
export const regenerateResumeToken = (id: string) =>
	api<{ share_token: string }>(`/resumes/${id}/regenerate-token`, { method: 'POST' });
export const getResumeContent = (id: string) => api<ResumeContent>(`/resumes/${id}/content`);
export const updateResumeContent = (id: string, content: ResumeContent) =>
	api<{ ok: boolean }>(`/resumes/${id}/content`, { method: 'PUT', body: JSON.stringify(content) });

export const resumeThemes = ['classic', 'compact', 'academic', 'sidebar'] as const;

export type TailorSkillRef = { id: string; name: string };

export type TailorAnalysis = {
	source: 'jd' | 'skills' | 'both';
	confirmed_skill_total: number;
	matched_from_jd: TailorSkillRef[];
	selected_by_user: TailorSkillRef[];
	applied_skills: TailorSkillRef[];
	not_in_jd: TailorSkillRef[];
	attached: {
		projects: number;
		experience: number;
		education: number;
		certifications: number;
		languages: number;
	};
	coverage_pct: number;
};

export type TailorResult = {
	resume: Resume;
	content: {
		skill_ids: string[];
		project_ids: string[];
		experience_ids: string[];
		education_ids: string[];
		certification_ids: string[];
		language_ids: string[];
	};
	matched_skill_ids: string[];
	analysis: TailorAnalysis;
};

export function tailorResume(data: {
	name: string;
	portfolio_id: string;
	theme_slug?: string;
	is_public?: number;
	headline?: string;
	bio?: string;
	skill_ids?: string[];
	jd_text?: string;
	include_matching?: boolean;
	approved?: {
		skill_ids: string[];
		project_ids?: string[];
		experience_ids?: string[];
	};
}) {
	return api<TailorResult>('/resumes/tailor', { method: 'POST', body: JSON.stringify(data) });
}

export function resumeShareUrl(shareToken: string): string {
	return corePublicUrl(`/r/${shareToken}`);
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export async function downloadResumeFio(resumeId: string, filenameHint = 'resume'): Promise<void> {
	const token = get(accessToken);
	const res = await fetch(`${API_BASE}/resumes/${resumeId}/export.fio`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || res.statusText);
	}
	const blob = await res.blob();
	const disposition = res.headers.get('Content-Disposition') ?? '';
	const match = /filename="([^"]+)"/.exec(disposition);
	const filename = match?.[1] ?? `${filenameHint.replace(/[^\w\-]+/g, '_')}.fio`;
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
