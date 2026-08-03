<script lang="ts">
	export let title = 'Upgrade to Pro';
	export let message = 'Unlock PDF export, unlimited portfolios, and remove Foliyo branding.';
	export let pricing: { monthlyInr: number; lifetimeInr: number } | null = null;
</script>

<div class="upgrade" role="status">
	<strong>{title}</strong>
	<p>{message}</p>
	{#if pricing}
		<p class="price">Pro ₹{pricing.monthlyInr}/mo · Lifetime ₹{pricing.lifetimeInr} launch offer</p>
	{:else}
		<p class="price">Pro ₹99/mo · Lifetime ₹2999 launch offer</p>
	{/if}
	<p class="hint">Checkout via Razorpay is next — for now, ask an admin to set your plan to <code>pro</code> for testing.</p>
	<slot />
</div>

<style>
	.upgrade {
		padding: 1rem 1.15rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		margin-bottom: 1rem;
	}
	.upgrade strong {
		display: block;
		font-size: 0.95rem;
		margin-bottom: 0.35rem;
	}
	.upgrade p {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.price {
		color: var(--color-text) !important;
		font-weight: 600;
	}
	.hint {
		font-size: 0.8125rem !important;
	}
	code {
		font-size: 0.8125rem;
	}
</style>
