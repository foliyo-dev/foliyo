<script lang="ts">
	import LibraryPreview from './LibraryPreview.svelte';

	let preview: LibraryPreview;

	export async function refreshPreview(): Promise<void> {
		await preview?.refresh();
	}
</script>

<div class="editor-with-preview">
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
