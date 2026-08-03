import { api } from './client';
import type { User } from '$lib/stores/auth';

export async function signup(
	email: string,
	password: string,
	consentPrivacyPolicy: boolean
): Promise<{ token: string; user: User }> {
	const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}/auth/signup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email,
			password,
			consent_privacy_policy: consentPrivacyPolicy
		})
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || res.statusText);
	}
	return res.json();
}

export const checkHandle = (handle: string) =>
	api<{ available: boolean; handle?: string; reason?: string }>(
		`/handle/check?handle=${encodeURIComponent(handle)}`
	);

export const claimHandle = (handle: string) =>
	api<{ ok: boolean; handle: string }>('/handle/claim', {
		method: 'POST',
		body: JSON.stringify({ handle })
	});

export type PlanInfo = {
	plan: string;
	plan_expires: string | null;
	billing_available: boolean;
};

/** @deprecated Prefer `$lib/api/plan` — kept for SaaS account helpers. */
export { getPlan } from './plan';

export const requestExport = () => api<{ ok: boolean; message: string }>('/account/export');

export const requestDelete = () =>
	api<{ ok: boolean; message: string }>('/account', { method: 'DELETE' });
