import { api, ApiError } from './client';
import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';
import { isProPlan } from './portfolios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export type PlanEntitlements = {
	portfolios_unlimited: boolean;
	pdf_export: boolean;
	remove_branding: boolean;
	portfolio_limit: number | null;
};

export type PlanInfo = {
	plan: string;
	stored_plan?: string;
	plan_expires: string | null;
	billing_available: boolean;
	pricing?: {
		monthlyInr: number;
		lifetimeInr: number;
		currency: string;
	};
	entitlements?: PlanEntitlements;
};

export const getPlan = () => api<PlanInfo>('/plan');

export type UpgradeError = {
	upgrade: true;
	message: string;
	feature?: string;
	pricing?: PlanInfo['pricing'];
};

export function parseUpgradeError(err: unknown): UpgradeError | null {
	if (!(err instanceof ApiError)) return null;
	try {
		const body = JSON.parse(err.message) as {
			upgrade?: boolean;
			message?: string;
			feature?: string;
			pricing?: PlanInfo['pricing'];
		};
		if (!body.upgrade) return null;
		return {
			upgrade: true,
			message: body.message || 'Upgrade to Pro to unlock this feature.',
			feature: body.feature,
			pricing: body.pricing
		};
	} catch {
		return null;
	}
}

/** Pro: opens printable HTML. Free: throws ApiError 402 with upgrade payload. */
export async function exportResume(id: string): Promise<void> {
	const token = get(accessToken);
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(`${API_BASE}/resumes/${id}/export`, { headers });
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}

	const html = await res.text();
	const blob = new Blob([html], { type: 'text/html' });
	const url = URL.createObjectURL(blob);
	const win = window.open(url, '_blank');
	if (!win) {
		URL.revokeObjectURL(url);
		throw new Error('Popup blocked — allow popups to export your resume.');
	}
	// Revoke after the new document has a chance to load.
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export { isProPlan };
