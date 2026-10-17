<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import LibraryPreview from './LibraryPreview.svelte';

	type Props = {
		children?: Snippet;
	};

	let { children }: Props = $props();

	const STORAGE_KEY = 'foliyo.preview.library.hidden';

	let preview: LibraryPreview | undefined = $state();
	let root: HTMLDivElement | undefined = $state();
	let previewHidden = $state(false);

	onMount(() => {
		try {
			previewHidden = localStorage.getItem(STORAGE_KEY) === '1';
		} catch {
			/* ignore */
		}
	});

	function togglePreview() {
		previewHidden = !previewHidden;
		try {
			localStorage.setItem(STORAGE_KEY, previewHidden ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

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
		<div class="preview-toggle-bar desktop-only">
			<button type="button" class="toggle" onclick={togglePreview}>
				{previewHidden ? 'Show preview' : 'Hide preview'}
			</button>
		</div>
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
	.preview-toggle-bar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-2);
	}
	.toggle {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius);
		padding: 0.25rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-muted);
		cursor: pointer;
	}
	.toggle:hover {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}

	@media (max-width: 1099px) {
		.editor-with-preview {
			display: block;
			min-height: 0;
		}
		.desktop-only {
			display: none;
		}
	}
</style>
