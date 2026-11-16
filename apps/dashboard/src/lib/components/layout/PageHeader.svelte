<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { setPageChrome, clearPageChrome } from '$lib/stores/pageChrome';
	import HeaderActionsPortal from './HeaderActionsPortal.svelte';

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

{#if actions}
	<HeaderActionsPortal>
		{@render actions()}
	</HeaderActionsPortal>
{/if}

{#if children}
	<div class="page-toolbar">
		<div class="toolbar-main">
			{@render children()}
		</div>
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
</style>
