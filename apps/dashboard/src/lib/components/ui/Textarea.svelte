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
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}
	textarea {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: inherit;
		resize: vertical;
		min-height: 5rem;
	}
	textarea:focus {
		border-color: var(--color-primary-muted);
		box-shadow: 0 0 0 3px var(--color-primary-light);
		outline: none;
	}
</style>
