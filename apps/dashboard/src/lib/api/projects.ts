import { api } from './client';

export type Project = {
  id: string;
  title: string;
  description: string;
  url: string;
  repo_url: string;
  article_url: string;
  image_url: string;
  skills_developed: string;
  featured: number;
  sort_order: number;
};

export const listProjects = () => api<Project[]>('/projects');
export const createProject = (data: Partial<Project>) =>
  api<Project[]>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Project>) =>
  api<{ ok: boolean }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  api<void>(`/projects/${id}`, { method: 'DELETE' });
