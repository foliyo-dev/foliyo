import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { isSaas } from '$lib/config';
import { loadSession, needsEmailVerification, user } from '$lib/stores/auth';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async () => {
	if (!isSaas) throw redirect(303, '/');
	const ok = await loadSession();
	if (!ok) throw redirect(303, '/login');
	if (needsEmailVerification(get(user))) throw redirect(303, '/check-email');
	return {};
};
