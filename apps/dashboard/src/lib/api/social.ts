import { api, type BulkResult } from './client';

export type SocialProvider =
	| 'github'
	| 'linkedin'
	| 'twitter'
	| 'youtube'
	| 'instagram'
	| 'dribbble'
	| 'behance'
	| 'medium'
	| 'bluesky'
	| 'mastodon'
	| 'website'
	| 'other';

export type SocialLink = {
	id: string;
	provider: SocialProvider;
	label: string;
	value: string;
	sort_order: number;
};

export type SocialProviderOption = {
	id: SocialProvider;
	label: string;
	usernameBased: boolean;
	placeholder: string;
};

/** Keep in sync with @foliyo/core/social/providers */
export const socialProviders: SocialProviderOption[] = [
	{ id: 'github', label: 'GitHub', usernameBased: true, placeholder: 'username' },
	{ id: 'linkedin', label: 'LinkedIn', usernameBased: true, placeholder: 'username' },
	{ id: 'twitter', label: 'X / Twitter', usernameBased: true, placeholder: 'username' },
	{ id: 'youtube', label: 'YouTube', usernameBased: true, placeholder: '@channel' },
	{ id: 'instagram', label: 'Instagram', usernameBased: true, placeholder: 'username' },
	{ id: 'dribbble', label: 'Dribbble', usernameBased: true, placeholder: 'username' },
	{ id: 'behance', label: 'Behance', usernameBased: true, placeholder: 'username' },
	{ id: 'medium', label: 'Medium', usernameBased: true, placeholder: 'username' },
	{ id: 'bluesky', label: 'Bluesky', usernameBased: true, placeholder: 'handle.bsky.social' },
	{ id: 'mastodon', label: 'Mastodon', usernameBased: false, placeholder: 'https://mastodon.social/@you' },
	{ id: 'website', label: 'Website', usernameBased: false, placeholder: 'https://yoursite.com' },
	{ id: 'other', label: 'Other', usernameBased: false, placeholder: 'https://…' }
];

export function providerMeta(id: SocialProvider): SocialProviderOption {
	return socialProviders.find((p) => p.id === id) ?? socialProviders[socialProviders.length - 1]!;
}

export const listSocialLinks = () => api<SocialLink[]>('/social-links');
export const createSocialLink = (data: Partial<SocialLink>) =>
	api<SocialLink[]>('/social-links', { method: 'POST', body: JSON.stringify(data) });
export const bulkCreateSocialLinks = (items: Partial<SocialLink>[]) =>
	api<BulkResult<SocialLink>>('/social-links/bulk', { method: 'POST', body: JSON.stringify({ items }) });
export const updateSocialLink = (id: string, data: Partial<SocialLink>) =>
	api<{ ok: boolean }>(`/social-links/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSocialLink = (id: string) =>
	api<void>(`/social-links/${id}`, { method: 'DELETE' });
export const listDeletedSocialLinks = () => api<SocialLink[]>(`/social-links/deleted`);
export const restoreSocialLink = (id: string) =>
	api<{ ok: boolean }>(`/social-links/${id}/restore`, { method: 'POST', body: '{}' });
export const purgeSocialLink = (id: string) =>
	api<void>(`/social-links/${id}/purge`, { method: 'DELETE' });
