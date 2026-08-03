<div class="card">
	<slot />
</div>

<style>
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 1.5rem;
		box-shadow: 0 4px 24px rgba(83, 74, 183, 0.08);
	}
</style>
