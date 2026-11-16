<script lang="ts">
	import type { Snippet } from 'svelte';
	import { pageChrome } from '$lib/stores/pageChrome';
	import {
		libraryPreviewChrome,
		toggleLibraryPreview
	} from '$lib/stores/libraryPreviewChrome';

	type Props = {
		onmenu?: () => void;
		children?: Snippet;
	};

	let { onmenu, children }: Props = $props();

	const title = $derived($pageChrome.title);
	const description = $derived($pageChrome.description);
	const preview = $derived($libraryPreviewChrome);
</script>

<header>
	<div class="left">
		<button type="button" class="menu-btn" aria-label="Open menu" onclick={() => onmenu?.()}>
			<span class="bar"></span>
			<span class="bar"></span>
			<span class="bar"></span>
		</button>
		<div class="titles">
			{#if title}
				<h1 class="title">{title}</h1>
				{#if description}
					<p class="desc">{description}</p>
				{/if}
			{:else if children}
				<div class="slot">
					{@render children()}
				</div>
			{/if}
		</div>
	</div>
	<div class="right">
		<div id="app-header-actions" class="page-actions"></div>
		{#if preview}
			<button
				type="button"
				class="preview-toggle desktop-only"
				onclick={toggleLibraryPreview}
			>
				{preview.hidden ? 'Show preview' : 'Hide preview'}
			</button>
		{/if}
	</div>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: var(--header-height);
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		flex-shrink: 0;
		box-sizing: border-box;
		gap: var(--space-3);
	}
	.left {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
		flex: 1;
	}
	.titles {
		min-width: 0;
		flex: 1;
	}
	.title {
		margin: 0;
		font-size: 1.0625rem;
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: -0.02em;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.desc {
		margin: 0.1rem 0 0;
		color: var(--color-muted);
		font-size: 0.75rem;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.slot {
		min-width: 0;
		flex: 1;
	}
	.right {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		flex-shrink: 0;
	}
	.page-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.page-actions:empty {
		display: none;
	}
	.right :global(.count) {
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.right :global(.status-chip) {
		flex-shrink: 0;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border: 1px solid var(--color-border);
		color: var(--color-muted);
		background: var(--color-surface);
	}
	.right :global(.status-chip.published) {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.preview-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 1.875rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font-weight: 500;
		font-size: 0.8125rem;
		line-height: 1.25;
		cursor: pointer;
	}
	.preview-toggle:hover {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.menu-btn {
		display: none;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		cursor: pointer;
		flex-shrink: 0;
	}
	.menu-btn:hover {
		border-color: var(--color-primary-muted);
	}
	.bar {
		display: block;
		height: 2px;
		width: 100%;
		border-radius: 1px;
		background: var(--color-text);
	}

	@media (max-width: 900px) {
		header {
			padding: var(--space-2) var(--space-3);
		}
		.menu-btn {
			display: inline-flex;
		}
		.desc {
			display: none;
		}
	}

	@media (max-width: 1099px) {
		.desktop-only {
			display: none;
		}
	}
</style>
