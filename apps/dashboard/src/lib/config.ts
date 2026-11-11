/** True when built for hosted SaaS (`VITE_SAAS=true`). */
export const isSaas = import.meta.env.VITE_SAAS === 'true';

/** Foliyo release version baked in at build time (from @foliyo/core). */
export const foliyoVersion = __FOLIYO_VERSION__;

const isDev = import.meta.env.DEV;

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function stripSlash(u: string): string {
	return u.replace(/\/$/, '');
}

/**
 * Dashboard app origin. SaaS bakes VITE_APP_URL; OSS hydrates from GET /api/public-config
 * (server FOLIYO_DASHBOARD_URL) so each self-host domain works without rebuilding.
 */
export let APP_BASE = stripSlash(
	import.meta.env.VITE_APP_URL ?? (isDev ? 'http://localhost:5173' : isSaas ? 'https://app.foliyo.dev' : '')
);

/**
 * Public site / API origin (portfolios live here).
 * OSS: filled by hydratePublicConfig() from FOLIYO_SITE_URL.
 */
export let siteUrl = stripSlash(
	import.meta.env.VITE_SITE_URL ?? (isDev ? 'http://localhost:8080' : isSaas ? 'https://foliyo.dev' : '')
);

/** Marketing landing (privacy policy). Defaults to siteUrl after hydrate on OSS. */
export let landingUrl = stripSlash(
	import.meta.env.VITE_LANDING_URL ?? (isDev ? 'http://localhost:5175' : isSaas ? 'https://foliyo.dev' : siteUrl)
);

export let privacyUrl = import.meta.env.VITE_PRIVACY_URL ?? `${landingUrl}/privacy`;

let hydratePromise: Promise<void> | null = null;

type PublicConfigResponse = {
	siteUrl?: string;
	dashboardUrl?: string;
	mode?: string;
};

/** Load site/dashboard URLs from the API (runtime env on the VPS). Safe to call multiple times. */
export function hydratePublicConfig(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	// Hosted SaaS already has correct bake-time URLs.
	if (isSaas && import.meta.env.VITE_SITE_URL) return Promise.resolve();
	if (hydratePromise) return hydratePromise;

	hydratePromise = (async () => {
		try {
			const res = await fetch(`${API_BASE}/public-config`);
			if (!res.ok) return;
			const data = (await res.json()) as PublicConfigResponse;
			if (data.siteUrl) {
				siteUrl = stripSlash(data.siteUrl);
				if (!import.meta.env.VITE_LANDING_URL) {
					landingUrl = siteUrl;
					if (!import.meta.env.VITE_PRIVACY_URL) {
						privacyUrl = `${landingUrl}/privacy`;
					}
				}
			}
			if (data.dashboardUrl && !import.meta.env.VITE_APP_URL) {
				APP_BASE = stripSlash(data.dashboardUrl);
			}
		} catch {
			/* keep bake-time / empty fallbacks */
		}
	})();

	return hydratePromise;
}

/** Host label for portfolio URLs, e.g. `localhost:8080` or `yourdomain.com`. */
export function publicHost(): string {
	try {
		if (siteUrl) return new URL(siteUrl).host;
	} catch {
		/* fall through */
	}
	if (typeof window !== 'undefined') return window.location.host;
	return isDev ? 'localhost:8080' : 'foliyo.dev';
}

export function publicPortfolioPath(handle: string): string {
	const base = siteUrl || (typeof window !== 'undefined' ? window.location.origin : '');
	return `${base}/u/${handle}`;
}

/** Resolve `/uploads/...` against the API/site origin for dashboard display. */
export function mediaUrl(path: string | null | undefined): string {
	const s = (path ?? '').trim();
	if (!s) return '';
	if (s.startsWith('/uploads/')) {
		const base = siteUrl || (typeof window !== 'undefined' ? window.location.origin : '');
		return `${base}${s}`;
	}
	return s;
}
