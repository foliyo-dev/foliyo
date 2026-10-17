<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';

	/** e.g. "Add role" / "Edit role" — the page decides the copy. */
	export let title: string;
</script>

<Card variant="panel">
	<h2 class="section-title">{title}</h2>
	<div class="fields">
		<slot name="fields" />
	</div>
	<div class="form-actions">
		<slot name="actions" />
	</div>
</Card>

<style>
	.section-title {
		margin: 0 0 var(--space-3);
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.form-actions {
		position: sticky;
		bottom: 0;
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding: var(--space-3) 0 var(--space-1);
		background: linear-gradient(
			to top,
			var(--color-surface) 70%,
			color-mix(in srgb, var(--color-surface) 0%, transparent)
		);
	}
</style>
