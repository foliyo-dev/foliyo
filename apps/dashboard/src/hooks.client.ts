import { accessToken } from '$lib/stores/token';

/**
 * Bootstrap session from marketing/onboarding handoff.
 * Uses `?access_token=` (not `?token=`) so email-verify links keep their query param.
 */
export function init() {
	if (typeof window === 'undefined') return;

	const url = new URL(window.location.href);

	// Email verification / other one-time links — do not strip or consume as session.
	if (url.pathname === '/verify' || url.pathname.startsWith('/verify/')) {
		return;
	}
	if (url.pathname === '/reset' || url.pathname.startsWith('/reset/')) {
		return;
	}

	const session = url.searchParams.get('access_token');
	if (!session) return;

	accessToken.set(session);
	url.searchParams.delete('access_token');
	const clean = url.pathname + url.search + url.hash;
	window.history.replaceState({}, '', clean);
}

init();
