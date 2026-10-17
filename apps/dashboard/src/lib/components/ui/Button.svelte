<script lang="ts">
	export let type: 'button' | 'submit' = 'button';
	export let variant: 'primary' | 'secondary' | 'ghost' = 'primary';
	export let disabled = false;
	/** Sets `aria-pressed`, for toggle-style buttons. */
	export let pressed: boolean | undefined = undefined;
	export let size: 'sm' | 'md' = 'md';
</script>

<button {type} class="{variant} size-{size}" {disabled} aria-pressed={pressed} on:click>
	<slot />
</button>

<style>
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--control-height);
		padding: 0 var(--space-4);
		border-radius: var(--radius);
		border: 1px solid transparent;
		cursor: pointer;
		font-weight: 500;
		font-size: 0.875rem;
		line-height: 1.25;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}
	.size-sm {
		min-height: 1.875rem;
		padding: 0 var(--space-3);
		font-size: 0.8125rem;
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
		background: var(--color-surface);
		border-color: var(--color-border);
		color: var(--color-text);
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
