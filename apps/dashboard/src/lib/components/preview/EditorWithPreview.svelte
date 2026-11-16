<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import LibraryPreview from './LibraryPreview.svelte';
	import {
		libraryPreviewChrome,
		setLibraryPreviewChrome
	} from '$lib/stores/libraryPreviewChrome';

	type Props = {
		children?: Snippet;
	};

	let { children }: Props = $props();

	const STORAGE_KEY = 'foliyo.preview.library.hidden';

	let preview: LibraryPreview | undefined = $state();
	let root: HTMLDivElement | undefined = $state();

	const previewHidden = $derived($libraryPreviewChrome?.hidden ?? false);

	onMount(() => {
		let hidden = false;
		try {
			hidden = localStorage.getItem(STORAGE_KEY) === '1';
		} catch {
			/* ignore */
		}
		setLibraryPreviewChrome({ hidden });
	});

	$effect(() => {
		const chrome = $libraryPreviewChrome;
		if (!chrome) return;
		try {
			localStorage.setItem(STORAGE_KEY, chrome.hidden ? '1' : '0');
		} catch {
			/* ignore */
		}
	});

	onDestroy(() => {
		setLibraryPreviewChrome(null);
	});

	export async function refreshPreview(): Promise<void> {
		await preview?.refresh();
	}

	/** Scroll the app content pane to the top so the edit form is visible. */
	export function scrollToForm(): void {
		let el: HTMLElement | null = root?.parentElement ?? null;
		while (el) {
			const { overflowY } = getComputedStyle(el);
			if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
				el.scrollTo({ top: 0, behavior: 'smooth' });
				return;
			}
			el = el.parentElement;
		}
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<div class="editor-with-preview" class:preview-hidden={previewHidden} bind:this={root}>
	<div class="editor">
		{#if children}
			{@render children()}
		{/if}
	</div>
	{#if !previewHidden}
		<LibraryPreview bind:this={preview} />
	{/if}
</div>

<style>
	.editor-with-preview {
		display: flex;
		align-items: stretch;
		gap: var(--space-3);
		min-height: 100%;
		width: 100%;
	}
	.editor {
		flex: 1 1 48%;
		min-width: 0;
	}
	.editor-with-preview.preview-hidden .editor {
		flex: 1 1 auto;
		max-width: 40rem;
	}
	.editor-with-preview:not(.preview-hidden) :global(aside.pane.desktop) {
		flex: 1 1 52%;
		min-width: 0;
		max-width: none;
	}

	@media (max-width: 1099px) {
		.editor-with-preview {
			display: block;
			min-height: 0;
		}
	}
</style>
