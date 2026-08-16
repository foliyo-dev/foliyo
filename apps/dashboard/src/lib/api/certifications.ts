import { api, type BulkResult } from './client';

export type Certification = {
	id: string;
	name: string;
	issuer: string;
	credential_id: string;
	credential_url: string;
	issued_at: string | null;
	expires_at: string | null;
	description: string;
	skills_developed: string;
	sort_order: number;
};

export const listCertifications = () => api<Certification[]>('/certifications');
export const createCertification = (data: Partial<Certification>) =>
	api<Certification[]>('/certifications', { method: 'POST', body: JSON.stringify(data) });
export const bulkCreateCertifications = (items: Partial<Certification>[]) =>
	api<BulkResult<Certification>>('/certifications/bulk', {
		method: 'POST',
		body: JSON.stringify({ items })
	});
export const updateCertification = (id: string, data: Partial<Certification>) =>
	api<{ ok: boolean }>(`/certifications/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCertification = (id: string) =>
	api<void>(`/certifications/${id}`, { method: 'DELETE' });
export const listDeletedCertifications = () => api<Certification[]>(`/certifications/deleted`);
export const restoreCertification = (id: string) =>
	api<{ ok: boolean }>(`/certifications/${id}/restore`, { method: 'POST', body: '{}' });
export const purgeCertification = (id: string) =>
	api<void>(`/certifications/${id}/purge`, { method: 'DELETE' });
