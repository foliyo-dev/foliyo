import { redirect } from '@sveltejs/kit';
import { isSaas } from '$lib/config';
import { loadSession, needsOnboarding, user } from '$lib/stores/auth';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async () => {
	if (!isSaas) throw redirect(303, '/login');
	const ok = await loadSession();
	if (ok) {
		if (needsOnboarding(get(user))) throw redirect(303, '/onboarding');
		throw redirect(303, '/');
	}
	return {};
};
