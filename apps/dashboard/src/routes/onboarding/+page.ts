import { redirect } from '@sveltejs/kit';
import { isSaas } from '$lib/config';
import { loadSession } from '$lib/stores/auth';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async () => {
	if (!isSaas) throw redirect(303, '/');
	const ok = await loadSession();
	if (!ok) throw redirect(303, '/signup');
	return {};
};
