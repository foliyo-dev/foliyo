import { writable } from 'svelte/store';

const STORAGE_KEY = 'foliyo_token';

function readStored(): string | null {
	if (typeof sessionStorage === 'undefined') return null;
	return sessionStorage.getItem(STORAGE_KEY);
}

/** Opaque API token — persisted in sessionStorage (survives refresh, cleared when tab closes). */
export const accessToken = writable<string | null>(readStored());

accessToken.subscribe((token) => {
	if (typeof sessionStorage === 'undefined') return;
	if (token) sessionStorage.setItem(STORAGE_KEY, token);
	else sessionStorage.removeItem(STORAGE_KEY);
});
