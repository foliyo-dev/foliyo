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
		font-size: 0.875rem;
	}
	.empty {
		margin-top: var(--space-3);
	}
	.list {
		list-style: none;
		margin: var(--space-3) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		overflow: hidden;
	}
	.list :global(> li + li) {
		border-top: 1px solid var(--color-border);
	}
</style>
