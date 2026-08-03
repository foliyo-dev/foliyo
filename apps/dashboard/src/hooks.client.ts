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

	const session =
		url.searchParams.get('access_token') ?? url.searchParams.get('token');
	if (!session) return;

	// Legacy `?token=` only on non-verify paths (dashboard handoff from older clients).
	accessToken.set(session);
	url.searchParams.delete('access_token');
	url.searchParams.delete('token');
	const clean = url.pathname + url.search + url.hash;
	window.history.replaceState({}, '', clean);
}

init();
