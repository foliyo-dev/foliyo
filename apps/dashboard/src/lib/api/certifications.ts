import { api } from './client';

export type Certification = {
	id: string;
	name: string;
	issuer: string;
	credential_id: string;
	credential_url: string;
	issued_at: string | null;
	expires_at: string | null;
	description: string;
	sort_order: number;
};

export const listCertifications = () => api<Certification[]>('/certifications');
export const createCertification = (data: Partial<Certification>) =>
	api<Certification[]>('/certifications', { method: 'POST', body: JSON.stringify(data) });
export const updateCertification = (id: string, data: Partial<Certification>) =>
	api<{ ok: boolean }>(`/certifications/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCertification = (id: string) =>
	api<void>(`/certifications/${id}`, { method: 'DELETE' });
