<script lang="ts">
	import { logout } from '$lib/stores/auth';
	import Button from '$lib/components/ui/Button.svelte';

	async function handleLogout() {
		await logout();
		window.location.href = '/login';
	}
</script>

<header>
	<slot />
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
	}
</style>
