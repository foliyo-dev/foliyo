import { get, writable } from 'svelte/store';

export type LibraryPreviewChrome = {
	hidden: boolean;
};

/**
 * Preview show/hide for library / blog editors.
 * State lives in the store so the sticky Header can toggle it without
 * holding a page callback (snippets/callbacks across trees were unreliable).
 */
export const libraryPreviewChrome = writable<LibraryPreviewChrome | null>(null);

export function setLibraryPreviewChrome(chrome: LibraryPreviewChrome | null) {
	libraryPreviewChrome.set(chrome);
}

export function toggleLibraryPreview() {
	const current = get(libraryPreviewChrome);
	if (!current) return;
	libraryPreviewChrome.set({ hidden: !current.hidden });
}
