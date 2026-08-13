<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';

	/** e.g. "Add role" / "Edit role" — the page decides the copy. */
	export let title: string;
</script>

<Card>
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
		margin: 0 0 1rem;
		font-size: 1rem;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.form-actions {
		position: sticky;
		bottom: 0;
		z-index: 5;
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.75rem 0 0.25rem;
		background: linear-gradient(
			to top,
			var(--color-surface) 70%,
			color-mix(in srgb, var(--color-surface) 0%, transparent)
		);
	}
</style>
