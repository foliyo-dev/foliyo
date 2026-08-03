import { accessToken } from '$lib/stores/token';

/** Bootstrap session from ?token= (e.g. marketing → app redirect). */
export function init() {
	if (typeof window === 'undefined') return;

	const url = new URL(window.location.href);
	const token = url.searchParams.get('token');
	if (!token) return;

	accessToken.set(token);
	url.searchParams.delete('token');
	const clean = url.pathname + url.search + url.hash;
	window.history.replaceState({}, '', clean);
}

init();
