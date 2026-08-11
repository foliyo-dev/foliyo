<script lang="ts">
	import PortfolioPreview from './PortfolioPreview.svelte';
	import type { PortfolioDraftPreview } from '$lib/api/preview';

	export let portfolioId: string | null = null;
	export let draft: PortfolioDraftPreview | null = null;
	export let portfolioName = 'Portfolio';
	export let liveUrl: string | null = null;

	let preview: PortfolioPreview;
	let root: HTMLDivElement;

	export async function refreshPreview(): Promise<void> {
		await preview?.refresh();
	}
</script>

<div class="editor-with-preview" bind:this={root}>
	<div class="editor">
		<slot />
	</div>
	<PortfolioPreview
		bind:this={preview}
		{portfolioId}
		{draft}
		{portfolioName}
		{liveUrl}
	/>
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
