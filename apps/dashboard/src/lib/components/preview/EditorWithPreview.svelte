<script lang="ts">
	import LibraryPreview from './LibraryPreview.svelte';

	let preview: LibraryPreview;
	let root: HTMLDivElement;

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

<div class="editor-with-preview" bind:this={root}>
	<div class="editor">
		<slot />
	</div>
	<LibraryPreview bind:this={preview} />
</div>

<style>
	.editor-with-preview {
		display: flex;
		align-items: flex-start;
		gap: 1.5rem;
		/* Fill the scrollport so the sticky preview can size to the window */
		min-height: 100%;
	}
	.editor {
		flex: 1 1 0;
		min-width: 0;
	}

	@media (max-width: 1099px) {
		.editor-with-preview {
			display: block;
			min-height: 0;
		}
	}
</style>
