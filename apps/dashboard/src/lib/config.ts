/** True when built for hosted SaaS (`VITE_SAAS=true`). */
export const isSaas = import.meta.env.VITE_SAAS === 'true';

const isDev = import.meta.env.DEV;

/** Public site / API origin (portfolios live here). */
export const siteUrl = (
	import.meta.env.VITE_SITE_URL ?? (isDev ? 'http://localhost:8080' : 'https://foliyo.dev')
).replace(/\/$/, '');

/** Marketing landing (privacy policy). */
export const landingUrl = (
	import.meta.env.VITE_LANDING_URL ?? (isDev ? 'http://localhost:5175' : 'https://foliyo.dev')
).replace(/\/$/, '');

export const privacyUrl =
	import.meta.env.VITE_PRIVACY_URL ?? `${landingUrl}/privacy`;

/** Host label for portfolio URLs, e.g. `localhost:8080` or `foliyo.dev`. */
export function publicHost(): string {
	try {
		return new URL(siteUrl).host;
	} catch {
		return isDev ? 'localhost:8080' : 'foliyo.dev';
	}
}

export function publicPortfolioPath(handle: string): string {
	return `${siteUrl}/u/${handle}`;
}
