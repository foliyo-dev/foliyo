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
	export let message =
		'Unlimited portfolios and remove Foliyo branding from public pages.';
	export let pricing: PlanInfo['pricing'] | null = null;
	export let billingAvailable = false;

	const dispatch = createEventDispatcher<{ upgraded: PlanInfo }>();

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
					theme: { color: '#0f766e' },
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
			// ApiError message is often raw JSON
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
	<p>{message}</p>
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
		<p class="hint">Secure checkout via Razorpay. Monthly grants 30 days of Pro access.</p>
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
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}
	.hint {
		font-size: 0.8125rem !important;
		margin-top: 0.65rem !important;
	}
	code {
		font-size: 0.8125rem;
	}
</style>
