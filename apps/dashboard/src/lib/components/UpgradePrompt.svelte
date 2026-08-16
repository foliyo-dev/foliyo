<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import {
		createUpgradeOrder,
		loadRazorpayCheckout,
		verifyUpgradePayment,
		type PlanInfo,
		type UpgradeKind
	} from '$lib/api/plan';
	import { loadSession, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';
	import { createEventDispatcher } from 'svelte';

	export let title = 'Upgrade to Pro';
	/** Optional short context above the feature list (e.g. limit messages). */
	export let message = '';
	export let pricing: PlanInfo['pricing'] | null = null;
	export let billingAvailable = false;
	/** When false, hide the default Pro feature checklist (context-only prompts). */
	export let showFeatures = true;

	const dispatch = createEventDispatcher<{ upgraded: PlanInfo }>();

	const features = [
		{ label: 'Unlimited portfolios & resumes', ai: false },
		{ label: 'PDF export (print-ready)', ai: false },
		{ label: 'Remove Foliyo branding', ai: false },
		{ label: 'Import resume — fill library from PDF/CV', ai: true },
		{ label: 'AI rewrite — stronger / shorter / metrics', ai: true },
		{ label: 'Daily AI unit budget', ai: true }
	];

	let busy: UpgradeKind | null = null;

	$: monthly = pricing?.monthlyInr ?? 99;
	$: lifetime = pricing?.lifetimeInr ?? 2999;

	async function checkout(kind: UpgradeKind) {
		if (!billingAvailable) {
			showToast('Billing is not configured yet.', 'error');
			return;
		}
		busy = kind;
		try {
			await loadRazorpayCheckout();
			const order = await createUpgradeOrder(kind);
			if (!window.Razorpay) throw new Error('Razorpay Checkout unavailable');

			await new Promise<void>((resolve, reject) => {
				const rzp = new window.Razorpay!({
					key: order.key_id,
					amount: order.amount,
					currency: order.currency,
					name: order.name,
					description: order.description,
					order_id: order.order_id,
					prefill: {
						email: $user?.email ?? ''
					},
					theme: { color: '#534ab7' },
					handler: async (response: {
						razorpay_order_id: string;
						razorpay_payment_id: string;
						razorpay_signature: string;
					}) => {
						try {
							const result = await verifyUpgradePayment(response);
							await loadSession();
							showToast(
								kind === 'lifetime' ? 'Lifetime unlocked — thank you!' : 'Pro unlocked for 30 days.',
								'success'
							);
							dispatch('upgraded', result);
							resolve();
						} catch (err) {
							reject(err);
						}
					},
					modal: {
						ondismiss: () => resolve()
					}
				});
				rzp.open();
			});
		} catch (err) {
			const text =
				err instanceof Error
					? err.message
					: typeof err === 'object' && err && 'message' in err
						? String((err as { message: string }).message)
						: 'Checkout failed';
			try {
				const parsed = JSON.parse(text) as { message?: string };
				showToast(parsed.message || text, 'error');
			} catch {
				showToast(text, 'error');
			}
		} finally {
			busy = null;
		}
	}
</script>

<div class="upgrade" role="status">
	<strong>{title}</strong>
	{#if message}
		<p class="context">{message}</p>
	{/if}

	{#if showFeatures}
		<ul class="features">
			{#each features as f}
				<li>
					{#if f.ai}<span class="ai">AI</span>{/if}
					{f.label}
				</li>
			{/each}
		</ul>
	{/if}

	<p class="price">Pro ₹{monthly}/mo · Lifetime ₹{lifetime} launch offer</p>

	{#if billingAvailable}
		<div class="actions">
			<Button disabled={busy !== null} on:click={() => checkout('monthly')}>
				{busy === 'monthly' ? 'Opening…' : `Pro ₹${monthly}/mo`}
			</Button>
			<Button variant="ghost" disabled={busy !== null} on:click={() => checkout('lifetime')}>
				{busy === 'lifetime' ? 'Opening…' : `Lifetime ₹${lifetime}`}
			</Button>
		</div>
		<p class="hint">
			Secure checkout via Razorpay — a one-time charge, not a subscription. We never auto-charge
			your card; Monthly grants 30 days of Pro and you renew manually whenever you like (we'll
			email a reminder a week before it expires).
		</p>
	{:else}
		<p class="hint">
			Checkout is not configured on this server. Set Razorpay keys, or ask an admin to set your plan
			to <code>pro</code> for testing.
		</p>
	{/if}
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
	.context {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.features {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.features li {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--color-text);
	}
	.features li::before {
		content: '';
		flex-shrink: 0;
		width: 0.4rem;
		height: 0.4rem;
		margin-top: 0.4rem;
		border-radius: 50%;
		background: var(--color-primary);
	}
	.ai {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.1rem;
		padding: 0.05rem 0.28rem;
		border-radius: 3px;
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		background: var(--color-primary);
		color: #fff;
		line-height: 1.2;
	}
	.price {
		margin: 0.85rem 0 0 !important;
		color: var(--color-text) !important;
		font-size: 0.875rem !important;
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}
	.hint {
		font-size: 0.8125rem !important;
		margin-top: 0.65rem !important;
		color: var(--color-muted);
		line-height: 1.45;
	}
	code {
		font-size: 0.8125rem;
	}
</style>
