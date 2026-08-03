<script lang="ts">
	export let type: 'button' | 'submit' = 'button';
	export let variant: 'primary' | 'secondary' | 'ghost' = 'primary';
	export let disabled = false;
	export let href: string | undefined = undefined;
</script>

{#if href}
	<a {href} class="btn {variant}" class:disabled aria-disabled={disabled}>
		<slot />
	</a>
{:else}
	<button {type} class="btn {variant}" {disabled} on:click>
		<slot />
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		border: 1px solid transparent;
		cursor: pointer;
		font-weight: 500;
		font: inherit;
		text-decoration: none;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.btn:disabled,
	.btn.disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}
	.primary {
		background: var(--color-primary);
		color: white;
	}
	.primary:hover:not(:disabled):not(.disabled) {
		background: var(--color-primary-hover);
		color: white;
	}
	.secondary {
		background: transparent;
		color: var(--color-primary);
		border-color: var(--color-primary-muted);
	}
	.secondary:hover:not(:disabled):not(.disabled) {
		background: var(--color-primary-light);
	}
	.ghost {
		background: transparent;
		border-color: var(--color-border);
		color: var(--color-text);
	}
	.ghost:hover:not(:disabled):not(.disabled) {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
</style>
