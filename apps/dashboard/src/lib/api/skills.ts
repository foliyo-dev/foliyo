import { api } from './client';

export type Skill = {
  id: string;
  name: string;
  level: string;
  category: string;
  sort_order: number;
};

export const listSkills = () => api<Skill[]>('/skills');
export const createSkill = (data: Partial<Skill>) =>
  api<Skill[]>('/skills', { method: 'POST', body: JSON.stringify(data) });
export const updateSkill = (id: string, data: Partial<Skill>) =>
  api<{ ok: boolean }>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSkill = (id: string) =>
  api<void>(`/skills/${id}`, { method: 'DELETE' });
