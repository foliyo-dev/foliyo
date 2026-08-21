import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';
import { api, ApiError } from './client';
import type { User } from '$lib/stores/auth';

const PENDING_EMAIL_KEY = 'foliyo_pending_email';

export function setPendingSignupEmail(email: string): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(PENDING_EMAIL_KEY, email);
}

export function getPendingSignupEmail(): string {
	if (typeof sessionStorage === 'undefined') return '';
	return sessionStorage.getItem(PENDING_EMAIL_KEY) ?? '';
}

export function clearPendingSignupEmail(): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(PENDING_EMAIL_KEY);
}

export async function signup(
	email: string,
	consentPrivacyPolicy: boolean
): Promise<{ ok: boolean }> {
	const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}/auth/signup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email,
			consent_privacy_policy: consentPrivacyPolicy
		})
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || res.statusText);
	}
	setPendingSignupEmail(email);
	return res.json();
}

export const checkHandle = (handle: string) =>
	api<{ available: boolean; handle?: string; reason?: string }>(
		`/handle/check?handle=${encodeURIComponent(handle.toLowerCase().trim())}`
	);

export const claimHandle = (handle: string) =>
	api<{ ok: boolean; handle: string }>('/handle/claim', {
		method: 'POST',
		body: JSON.stringify({ handle: handle.toLowerCase().trim() })
	});

export const skipHandleClaim = () =>
	api<{ ok: boolean; handle: string | null }>('/handle/skip', { method: 'POST' });

export type PlanInfo = {
	plan: string;
	plan_expires: string | null;
	billing_available: boolean;
};

/** @deprecated Prefer `$lib/api/plan` — kept for SaaS account helpers. */
export { getPlan } from './plan';

export type ConsentRow = {
	type: string;
	granted: number;
	created_at: string;
};

export const getConsents = () =>
	api<{ consents: ConsentRow[]; privacy_policy: ConsentRow | null }>('/account/consents');

export const getDataRequests = () =>
	api<{
		requests: Array<{
			id: string;
			type: string;
			status: string;
			requested_at: string;
			completed_at: string | null;
		}>;
		pending_delete: { id: string; requested_at: string } | null;
		grace_days: number;
	}>('/account/data-requests');

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

/** Download a JSON export of the user's data (DPDP). */
export async function downloadExport(): Promise<void> {
	const token = get(accessToken);
	const res = await fetch(`${API_BASE}/account/export`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `foliyo-export-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

export const requestDelete = () =>
	api<{ ok: boolean; message: string; signed_out?: boolean; grace_days?: number }>('/account', {
		method: 'DELETE',
		body: JSON.stringify({ confirm: 'DELETE' })
	});

export const verifyEmail = (token: string, password: string) =>
	api<{ token: string; user: User }>('/auth/verify', {
		method: 'POST',
		body: JSON.stringify({ token, password })
	});

export const resendVerification = (email: string) =>
	api<{ ok: boolean; already_verified?: boolean }>('/auth/resend-verification', {
		method: 'POST',
		body: JSON.stringify({ email })
	});

export const cancelAccountDeletion = (email: string, password: string) =>
	fetch(`${API_BASE}/auth/cancel-delete`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	}).then(async (res) => {
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || res.statusText);
		return data as { ok: boolean; message?: string };
	});
