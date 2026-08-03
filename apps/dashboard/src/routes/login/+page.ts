import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { loadSession, postAuthPath, user } from '$lib/stores/auth';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async () => {
	const ok = await loadSession();
	if (ok) {
		const u = get(user);
		if (u) throw redirect(303, postAuthPath(u));
	}
	return {};
};
