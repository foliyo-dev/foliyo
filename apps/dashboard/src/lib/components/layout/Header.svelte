<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { logout, user } from '$lib/stores/auth';
	import { formatPlanLabel, isPaidHostedPlan } from '$lib/api/plan';
	import { isSaas } from '$lib/config';
	import Button from '$lib/components/ui/Button.svelte';

	const dispatch = createEventDispatcher<{ menu: void }>();

	$: planSlug = $user?.plan ?? (isSaas ? 'free' : 'selfhost');
	$: planLabel = formatPlanLabel(planSlug);
	$: paid = isPaidHostedPlan(planSlug);

	async function handleLogout() {
		await logout();
		window.location.href = '/login';
	}
</script>

<header>
	<div class="left">
		<button type="button" class="menu-btn" aria-label="Open menu" on:click={() => dispatch('menu')}>
			<span class="bar"></span>
			<span class="bar"></span>
			<span class="bar"></span>
		</button>
		<div class="slot">
			<slot />
		</div>
	</div>
	<div class="right">
		{#if $user}
			<a
				href="/settings"
				class="plan-badge"
				class:paid
				class:free={planSlug === 'free'}
				title="Account plan — open Settings"
			>
				{planLabel}
			</a>
		{/if}
		<Button variant="ghost" on:click={handleLogout}>Log out</Button>
	</div>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 3.75rem;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		flex-shrink: 0;
		box-sizing: border-box;
		gap: 0.75rem;
	}
	.left {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		flex: 1;
	}
	.slot {
		min-width: 0;
		flex: 1;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.plan-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
		line-height: 1.2;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-muted);
	}
	.plan-badge.paid {
		border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
		background: var(--color-primary);
		color: #fff;
	}
	.plan-badge.free:hover,
	.plan-badge:not(.paid):hover {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
	}
	.plan-badge.paid:hover {
		filter: brightness(1.05);
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
			padding: 0 0.85rem;
		}
		.menu-btn {
			display: inline-flex;
		}
	}
</style>
