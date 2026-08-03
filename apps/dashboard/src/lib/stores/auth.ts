import { get, writable } from 'svelte/store';
import { api } from '$lib/api/client';
import { accessToken } from '$lib/stores/token';

export type User = {
	id: string;
	email: string;
	plan?: string;
	handle?: string | null;
	onboarding_complete?: number;
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

export async function login(email: string, password: string): Promise<void> {
	const data = await api<{ token: string; user: User }>('/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	});
	accessToken.set(data.token);
	user.set(data.user);
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
