import { writable, derived, get } from 'svelte/store';
import { getAiUsage, type AiUsage } from '$lib/api/ai';
import { isSaas } from '$lib/config';

const usage = writable<AiUsage | null>(null);
const loaded = writable(false);

export const aiUsage = { subscribe: usage.subscribe };

/** True when OpenRouter is configured on the API (Foliyo key or OSS BYOK). */
export const aiConfigured = derived(usage, ($u) => Boolean($u?.openrouter));

/** Self-host BYOK (no Foliyo unit pool). */
export const aiByok = derived(usage, ($u) => Boolean($u?.byok) || (!isSaas && Boolean($u?.openrouter)));

let inflight: Promise<AiUsage | null> | null = null;

/** Fetch /ai/usage once (safe to call from multiple pages). */
export async function ensureAiUsage(force = false): Promise<AiUsage | null> {
	if (!force && get(loaded)) return get(usage);
	if (inflight) return inflight;
	inflight = (async () => {
		try {
			const next = await getAiUsage();
			usage.set(next);
			return next;
		} catch {
			usage.set(null);
			return null;
		} finally {
			loaded.set(true);
			inflight = null;
		}
	})();
	return inflight;
}

export function setAiUsage(next: AiUsage | null) {
	usage.set(next);
	loaded.set(true);
}
