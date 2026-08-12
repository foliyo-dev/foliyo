<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { logout } from '$lib/stores/auth';
	import Button from '$lib/components/ui/Button.svelte';

	const dispatch = createEventDispatcher<{ menu: void }>();

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
	<Button variant="ghost" on:click={handleLogout}>Log out</Button>
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
