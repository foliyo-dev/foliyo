<script lang="ts">
	export let title = '';
	export let description = '';
</script>

<div class="page-header">
	<h1>{title}</h1>
	{#if description}<p>{description}</p>{/if}
</div>

<style>
	.page-header {
		margin-bottom: 1.5rem;
	}
	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: -0.02em;
	}
	p {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.9375rem;
	}
</style>
