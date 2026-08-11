import { api } from './client';

export type Skill = {
  id: string;
  name: string;
  level: string;
  category: string;
  source?: string;
  status?: 'pending' | 'confirmed' | 'dismissed';
  recency?: 'current' | 'past';
  sort_order: number;
  evidence?: string[];
  suggested_level?: string;
  suggested_recency?: 'current' | 'past';
  suggested_years?: number | null;
};

export const listSkills = (status?: string) =>
  api<Skill[]>(`/skills${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const createSkill = (data: Partial<Skill>) =>
  api<Skill[]>('/skills', { method: 'POST', body: JSON.stringify(data) });
export const updateSkill = (id: string, data: Partial<Skill>) =>
  api<{ ok: boolean }>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSkill = (id: string) =>
  api<void>(`/skills/${id}`, { method: 'DELETE' });
export const suggestSkillsFromLibrary = () =>
  api<{ found: number; pending: number }>('/skills/suggest-from-library', { method: 'POST', body: '{}' });
export const confirmSkill = (
  id: string,
  data?: { level?: string; category?: string; recency?: 'current' | 'past' },
) => api<Skill>(`/skills/${id}/confirm`, { method: 'POST', body: JSON.stringify(data ?? {}) });
export const dismissSkill = (id: string) =>
  api<{ ok: boolean }>(`/skills/${id}/dismiss`, { method: 'POST', body: '{}' });
