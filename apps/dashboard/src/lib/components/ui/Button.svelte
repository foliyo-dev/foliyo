<script lang="ts">
	export let type: 'button' | 'submit' = 'button';
	export let variant: 'primary' | 'ghost' = 'primary';
	export let disabled = false;
</script>

<button {type} class={variant} {disabled} on:click>
	<slot />
</button>

<style>
	button {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		border: 1px solid transparent;
		cursor: pointer;
		font-weight: 500;
		transition: background 0.15s ease, border-color 0.15s ease;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.primary {
		background: var(--color-primary);
		color: white;
	}
	.primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}
	.ghost {
		background: transparent;
		border-color: var(--color-border);
		color: var(--color-text);
	}
	.ghost:hover:not(:disabled) {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
</style>
