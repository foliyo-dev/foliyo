import { get, writable } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { accessToken } from '$lib/stores/token';
import { isSaas } from '$lib/config';

export type User = {
	id: string;
	email: string;
	plan?: string;
	handle?: string | null;
	/** ISO timestamp of the last handle change/claim — used to enforce a change cooldown. */
	handle_changed_at?: string | null;
	onboarding_complete?: number;
	email_verified?: number;
};

export const user = writable<User | null>(null);

export async function loadSession(): Promise<boolean> {
	if (!get(accessToken)) {
		user.set(null);
		return false;
	}
	try {
		const data = await api<{ user: User }>('/auth/me');
		user.set(data.user);
		return true;
	} catch {
		accessToken.set(null);
		user.set(null);
		return false;
	}
}

export async function login(email: string, password: string): Promise<User> {
	try {
		const data = await api<{ token: string; user: User }>('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password })
		});
		accessToken.set(data.token);
		user.set(data.user);
		return data.user;
	} catch (err) {
		if (err instanceof ApiError && err.message.includes('pending_deletion')) {
			throw new Error('pending_deletion');
		}
		if (err instanceof ApiError && err.message.includes('email_not_verified')) {
			throw new Error('email_not_verified');
		}
		throw err;
	}
}

/** Changes the current user's password, verifying `currentPassword` server-side. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
	await api('/auth/change-password', {
		method: 'POST',
		body: JSON.stringify({ currentPassword, newPassword })
	});
}

export async function logout(): Promise<void> {
	try {
		await api('/auth/logout', { method: 'POST' });
	} finally {
		accessToken.set(null);
		user.set(null);
	}
}

export function needsOnboarding(u: User | null): boolean {
	if (!u) return false;
	return !u.handle || u.onboarding_complete !== 1;
}

export function needsEmailVerification(u: User | null): boolean {
	if (!isSaas || !u) return false;
	return !u.email_verified;
}

/** After login/signup/verify on the dashboard (same origin). */
export function postAuthPath(u: User): string {
	if (needsEmailVerification(u)) return '/check-email';
	if (isSaas && needsOnboarding(u)) return '/onboarding';
	return '/';
}
