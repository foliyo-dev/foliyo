import { redirect } from '@sveltejs/kit';
import { isSaas } from '$lib/config';
import {
	loadSession,
	needsEmailVerification,
	needsOnboarding,
	user
} from '$lib/stores/auth';
import { get } from 'svelte/store';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = async () => {
	const ok = await loadSession();
	if (!ok) throw redirect(303, '/login');
	const u = get(user);
	if (needsEmailVerification(u)) throw redirect(303, '/check-email');
	if (isSaas && needsOnboarding(u)) throw redirect(303, '/onboarding');
	return {};
};
