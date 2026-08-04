import { api, ApiError } from './client';
import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';
import { parseUpgradeError, type UpgradeError } from './plan';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export type ResumeImportDraft = {
	candidate: {
		name: string;
		headline: string;
		bio: string;
		email: string;
		location: string;
		links: Record<string, string>;
	};
	skills: Array<{ name: string; level: string | null; category: string | null }>;
	experience: Array<{
		company: string;
		role: string;
		location: string | null;
		start: string | null;
		end: string | null;
		current: boolean;
		description: string | null;
	}>;
	education: Array<{
		institution: string;
		degree: string | null;
		field: string | null;
		start: string | null;
		end: string | null;
		description: string | null;
	}>;
	projects: Array<{
		title: string;
		description: string | null;
		url: string | null;
		repo_url: string | null;
		tags: string[];
		featured: boolean;
	}>;
	certifications: Array<{
		name: string;
		issuer: string | null;
		credential_id: string | null;
		credential_url: string | null;
		issued_at: string | null;
		expires_at: string | null;
		description: string | null;
	}>;
	languages: Array<{ language: string; proficiency: string | null }>;
};

export type ResumeImportResponse = {
	draft: ResumeImportDraft;
	meta: {
		model: string;
		schema: string;
		tokens_in: number;
		tokens_out: number;
		remaining_today: number;
	};
};

export class ImportLimitError extends Error {
	constructor(
		message: string,
		public limit?: number,
		public used?: number
	) {
		super(message);
	}
}

async function parseImportError(res: Response): Promise<never> {
	const text = await res.text();
	try {
		const body = JSON.parse(text) as {
			error?: string;
			message?: string;
			upgrade?: boolean;
			limit?: number;
			used?: number;
		};
		if (body.upgrade) {
			const upgrade = parseUpgradeError(new ApiError(text, res.status));
			if (upgrade) throw Object.assign(new ApiError(text, res.status), { upgrade });
		}
		if (res.status === 429 || body.error === 'daily_cap_reached') {
			throw new ImportLimitError(body.message || text, body.limit, body.used);
		}
		throw new ApiError(body.message || text || res.statusText, res.status);
	} catch (err) {
		if (err instanceof ApiError || err instanceof ImportLimitError) throw err;
		throw new ApiError(text || res.statusText, res.status);
	}
}

export async function importResumeFromText(text: string): Promise<ResumeImportResponse> {
	const token = get(accessToken);
	const res = await fetch(`${API_BASE}/import/resume`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify({ text })
	});
	if (!res.ok) await parseImportError(res);
	return res.json() as Promise<ResumeImportResponse>;
}

export async function importResumeFromPdf(file: File): Promise<ResumeImportResponse> {
	const token = get(accessToken);
	const form = new FormData();
	form.append('file', file);
	const res = await fetch(`${API_BASE}/import/resume`, {
		method: 'POST',
		headers: {
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: form
	});
	if (!res.ok) await parseImportError(res);
	return res.json() as Promise<ResumeImportResponse>;
}

export function getImportUpgrade(err: unknown): UpgradeError | null {
	if (err instanceof ApiError) return parseUpgradeError(err);
	return null;
}
