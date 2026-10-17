<script lang="ts">
	export let label = '';
	export let value = '';
	export let name = '';
	export let placeholder = '';
	export let rows = 4;
</script>

<label>
	{#if label}<span class="label">{label}</span>{/if}
	<textarea {name} {placeholder} {rows} bind:value></textarea>
</label>

<style>
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}
	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: inherit;
		font-size: 0.875rem;
		resize: vertical;
		min-height: 5rem;
	}
	textarea:focus {
		border-color: var(--color-primary-muted);
		box-shadow: var(--focus-ring);
		outline: none;
	}
</style>
