<script lang="ts">
	import type { Snippet } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { Logo } from '@foliyo/ui';

	type Props = {
		showLogo?: boolean;
		title?: string;
		description?: string;
		children?: Snippet;
		logo?: Snippet;
	};

	let {
		showLogo = false,
		title = '',
		description = '',
		children,
		logo
	}: Props = $props();
</script>

<div class="auth-shell">
	<Card variant="panel">
		<div class="auth-card">
			{#if showLogo || logo}
				<div class="logo-wrap">
					{#if logo}
						{@render logo()}
					{:else}
						<Logo height={28} />
					{/if}
				</div>
			{/if}
			{#if title}
				<h1>{title}</h1>
			{/if}
			{#if description}
				<p class="lead muted">{description}</p>
			{/if}
			{#if children}
				{@render children()}
			{/if}
		</div>
	</Card>
</div>

<style>
	.auth-shell {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		background: linear-gradient(160deg, var(--color-primary-light) 0%, var(--color-bg) 45%);
	}
	.auth-shell :global(.card.panel) {
		width: 100%;
		max-width: 26rem;
		padding: var(--space-6) var(--space-5);
		box-shadow: var(--shadow-md);
	}
	.auth-card {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.logo-wrap {
		display: flex;
		justify-content: center;
		margin-bottom: var(--space-4);
	}
	.logo-wrap :global(svg),
	.logo-wrap :global(img) {
		display: block;
		max-width: 100%;
		height: auto;
	}
	h1 {
		margin: 0 0 var(--space-1);
		font-size: 1.25rem;
		font-weight: 600;
		text-align: center;
		letter-spacing: -0.02em;
	}
	.lead {
		margin: 0 0 var(--space-4);
		text-align: center;
		font-size: 0.875rem;
		line-height: 1.45;
	}
	.muted {
		color: var(--color-muted);
	}
	.auth-card :global(form) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-1);
	}
	.auth-card :global(.footer) {
		margin-top: var(--space-4);
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.auth-card :global(.footer a) {
		font-weight: 500;
	}
</style>
