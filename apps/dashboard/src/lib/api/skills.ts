import { api, type BulkResult } from './client';

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
  deleted_at?: string | null;
};

export const listSkills = (status?: string) =>
  api<Skill[]>(`/skills${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const createSkill = (data: Partial<Skill>) =>
  api<Skill[]>('/skills', { method: 'POST', body: JSON.stringify(data) });
export const bulkCreateSkills = (items: Partial<Skill>[]) =>
  api<BulkResult<Skill>>('/skills/bulk', { method: 'POST', body: JSON.stringify({ items }) });
export const updateSkill = (id: string, data: Partial<Skill>) =>
  api<{ ok: boolean }>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSkill = (id: string) =>
  api<void>(`/skills/${id}`, { method: 'DELETE' });
export const listDeletedSkills = () => api<Skill[]>(`/skills/deleted`);
export const restoreSkill = (id: string) =>
  api<{ ok: boolean }>(`/skills/${id}/restore`, { method: 'POST', body: '{}' });
export const purgeSkill = (id: string) =>
  api<void>(`/skills/${id}/purge`, { method: 'DELETE' });
export const confirmSkill = (
  id: string,
  data?: { level?: string; category?: string; recency?: 'current' | 'past' },
) => api<Skill>(`/skills/${id}/confirm`, { method: 'POST', body: JSON.stringify(data ?? {}) });
export const dismissSkill = (id: string) =>
  api<{ ok: boolean }>(`/skills/${id}/dismiss`, { method: 'POST', body: '{}' });

export type BulkConfirmResult = {
	confirmed: number;
	missing: string[];
	items: Skill[];
};

export type BulkDismissResult = {
	dismissed: number;
	missing: string[];
	items: Skill[];
};

export const confirmSkillsBulk = (ids: string[]) =>
	api<BulkConfirmResult>('/skills/confirm-bulk', {
		method: 'POST',
		body: JSON.stringify({ ids })
	});

export const dismissSkillsBulk = (ids: string[]) =>
	api<BulkDismissResult>('/skills/dismiss-bulk', {
		method: 'POST',
		body: JSON.stringify({ ids })
	});