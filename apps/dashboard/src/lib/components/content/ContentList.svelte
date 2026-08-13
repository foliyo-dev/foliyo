<script lang="ts">
	export let loading: boolean;
	export let empty: boolean;
	export let emptyMessage: string;
</script>

{#if loading}
	<p class="muted">Loading…</p>
{:else if empty}
	<p class="muted empty">{emptyMessage}</p>
{:else}
	<ul class="list">
		<slot />
	</ul>
{/if}

<style>
	.muted {
		color: var(--color-muted);
	}
	.empty {
		margin-top: 1rem;
	}
	.list {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
