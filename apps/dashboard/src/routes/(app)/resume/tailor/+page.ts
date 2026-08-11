import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Tailor is merged into /resume — keep old links working. */
export const load: PageLoad = () => {
	throw redirect(308, '/resume');
};
