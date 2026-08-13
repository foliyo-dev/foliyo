import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';
import { api, ApiError, type BulkResult } from './client';

export type Project = {
  id: string;
  title: string;
  description: string;
  url: string;
  repo_url: string;
  article_url: string;
  image_url: string;
  url_label: string;
  repo_url_label: string;
  article_url_label: string;
  skills_developed: string;
  featured: number;
  sort_order: number;
};

export const listProjects = () => api<Project[]>('/projects');
export const createProject = (data: Partial<Project>) =>
  api<Project[]>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const bulkCreateProjects = (items: Partial<Project>[]) =>
  api<BulkResult<Project>>('/projects/bulk', { method: 'POST', body: JSON.stringify({ items }) });
export const updateProject = (id: string, data: Partial<Project>) =>
  api<{ ok: boolean }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
	api<void>(`/projects/${id}`, { method: 'DELETE' });

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export async function uploadProjectImage(file: File): Promise<{ url: string }> {
	const token = get(accessToken);
	const form = new FormData();
	form.append('file', file);
	const res = await fetch(`${API_BASE}/upload/project-image`, {
		method: 'POST',
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		body: form
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	return res.json() as Promise<{ url: string }>;
}
