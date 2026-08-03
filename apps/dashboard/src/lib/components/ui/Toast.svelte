<script lang="ts">
	import { toasts } from '$lib/stores/toast';
</script>

<div class="toasts">
	{#each $toasts as t (t.id)}
		<div class="toast {t.type}">{t.message}</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		z-index: 100;
	}
	.toast {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 4px 16px rgba(26, 26, 46, 0.12);
		color: var(--color-text);
		font-size: 0.875rem;
	}
	.error {
		border-color: #fecaca;
		background: #fef2f2;
		color: var(--color-error);
	}
	.success {
		border-color: #bbf7d0;
		background: #f0fdf4;
		color: var(--color-success);
	}
</style>
