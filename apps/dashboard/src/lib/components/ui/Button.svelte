<script lang="ts">
	export let type: 'button' | 'submit' = 'button';
	export let variant: 'primary' | 'secondary' | 'ghost' = 'primary';
	export let disabled = false;
	/** Sets `aria-pressed`, for toggle-style buttons. */
	export let pressed: boolean | undefined = undefined;
</script>

<button {type} class={variant} {disabled} aria-pressed={pressed} on:click>
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
	.secondary {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-primary-deep);
		font-weight: 600;
	}
	.secondary:hover:not(:disabled) {
		background: var(--color-accent-hover);
		border-color: var(--color-accent-hover);
	}
	.ghost {
		background: var(--color-primary-light);
		border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border));
		color: var(--color-primary);
	}
	.ghost:hover:not(:disabled) {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.ghost[aria-pressed='true'] {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background: var(--color-primary-light);
		font-weight: 600;
	}
</style>
