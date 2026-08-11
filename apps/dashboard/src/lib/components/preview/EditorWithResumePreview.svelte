<script lang="ts">
	import ResumePreview from './ResumePreview.svelte';

	export let resumeId: string | null = null;
	export let resumeName = 'Resume';

	let preview: ResumePreview;
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
	<ResumePreview bind:this={preview} {resumeId} {resumeName} />
</div>

<style>
	.editor-with-preview {
		display: flex;
		align-items: flex-start;
		gap: 1.5rem;
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
