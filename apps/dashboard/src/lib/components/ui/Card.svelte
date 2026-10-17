<script lang="ts">
	export let variant: 'default' | 'flush' | 'list' | 'panel' = 'default';
</script>

<div class="card {variant}">
	<slot />
</div>

<style>
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: var(--space-5);
		box-shadow: var(--shadow-sm);
	}
	.flush {
		padding: 0;
		box-shadow: none;
		border: none;
		background: transparent;
		border-radius: 0;
	}
	.list {
		padding: var(--space-3) var(--space-4);
		box-shadow: none;
		border-radius: 0;
	}
	.panel {
		padding: var(--space-4);
		box-shadow: var(--shadow-xs);
	}
</style>
