import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';
import { ApiError } from './client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

/** Fetch rendered library preview HTML (auth required). */
export async function fetchLibraryPreviewHtml(theme?: string): Promise<string> {
	const token = get(accessToken);
	const qs = theme ? `?theme=${encodeURIComponent(theme)}` : '';
	const res = await fetch(`${API_BASE}/preview/library${qs}`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}
	return res.text();
}
