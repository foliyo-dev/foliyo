<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { setPageChrome, clearPageChrome } from '$lib/stores/pageChrome';

	type Props = {
		title?: string;
		description?: string;
		children?: Snippet;
		actions?: Snippet;
	};

	let { title = '', description = '', children, actions }: Props = $props();

	$effect(() => {
		setPageChrome(title, description);
	});

	onDestroy(() => {
		clearPageChrome();
	});
</script>

<svelte:head>
	<title>{title ? `${title} · Foliyo` : 'Foliyo'}</title>
</svelte:head>

{#if children || actions}
	<div class="page-toolbar">
		{#if children}
			<div class="toolbar-main">
				{@render children()}
			</div>
		{/if}
		{#if actions}
			<div class="toolbar-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
{/if}

<style>
	.page-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.toolbar-main {
		min-width: 0;
		flex: 1;
	}
	.toolbar-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}
</style>
