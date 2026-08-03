import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/token';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const token = get(accessToken);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string> | undefined)
	};
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers
	});

	if (!res.ok) {
		const text = await res.text();
		throw new ApiError(text || res.statusText, res.status);
	}

	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}
