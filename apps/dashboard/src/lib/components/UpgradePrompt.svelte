<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import BillingAddressForm from '$lib/components/BillingAddressForm.svelte';
	import {
		createUpgradeOrder,
		loadRazorpayCheckout,
		verifyUpgradePayment,
		type PlanInfo,
		type UpgradeKind
	} from '$lib/api/plan';
	import {
		getBilling,
		saveBilling,
		type BillingPayload,
		type BillingProfile,
		type IndianState
	} from '$lib/api/billing';
	import { ApiError } from '$lib/api/client';
	import { loadSession, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';
	import { createEventDispatcher } from 'svelte';

	export let title = 'Upgrade to Pro';
	export let message = '';
	export let pricing: PlanInfo['pricing'] | null = null;
	export let billingAvailable = false;
	export let billingComplete = false;
	export let showFeatures = true;

	const dispatch = createEventDispatcher<{ upgraded: PlanInfo; billingSaved: void }>();

	const features = [
		{ label: 'Unlimited portfolios & resumes', ai: false },
		{ label: 'PDF export (print-ready)', ai: false },
		{ label: 'Remove Foliyo branding', ai: false },
		{ label: 'Write & publish a blog on your site', ai: false },
		{ label: 'Import resume — fill library from PDF/CV', ai: true },
		{ label: 'AI rewrite — stronger / shorter / metrics', ai: true },
		{ label: 'AI resume summary from JD + library', ai: true },
		{ label: 'Daily AI unit budget', ai: true }
	];

	let busy: UpgradeKind | null = null;
	let billingDialog: HTMLDialogElement | undefined;
	let billingProfile: BillingProfile | null = null;
	let billingStates: IndianState[] = [];
	let billingBusy = false;
	let pendingKind: UpgradeKind | null = null;

	$: monthly = pricing?.monthlyInr ?? 99;
	$: lifetime = pricing?.lifetimeInr ?? 2999;

	async function ensureBillingLoaded() {
		if (billingProfile) return;
		const res = await getBilling();
		billingProfile = res.profile;
		billingStates = res.states;
		billingComplete = res.profile.complete;
	}

	async function openBillingModal(kind: UpgradeKind) {
		pendingKind = kind;
		try {
			await ensureBillingLoaded();
			billingDialog?.showModal();
		} catch {
			showToast('Could not load billing form.', 'error');
			pendingKind = null;
		}
	}

	async function onBillingSave(e: CustomEvent<BillingPayload>) {
		billingBusy = true;
		try {
			const res = await saveBilling(e.detail);
			billingProfile = res.profile;
			billingComplete = res.profile.complete;
			billingDialog?.close();
			dispatch('billingSaved');
			showToast('Billing address saved.', 'success');
			const kind = pendingKind;
			pendingKind = null;
			if (kind) await runCheckout(kind);
		} catch (err) {
			const text = err instanceof ApiError ? err.message : 'Could not save billing address.';
			try {
				const parsed = JSON.parse(text) as { message?: string };
				showToast(parsed.message || text, 'error');
			} catch {
				showToast(text, 'error');
			}
		} finally {
			billingBusy = false;
		}
	}

	async function checkout(kind: UpgradeKind) {
		if (!billingAvailable) {
			showToast('Billing is not configured yet.', 'error');
			return;
		}
		if (!billingComplete) {
			await openBillingModal(kind);
			return;
		}
		await runCheckout(kind);
	}

	async function runCheckout(kind: UpgradeKind) {
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
				const parsed = JSON.parse(text) as { message?: string; error?: string };
				if (parsed.error === 'billing_required') {
					billingComplete = false;
					await openBillingModal(kind);
					return;
				}
				showToast(parsed.message || text, 'error');
			} catch {
				showToast(text, 'error');
			}
		} finally {
			busy = null;
		}
	}

	function closeBillingModal() {
		pendingKind = null;
		billingDialog?.close();
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
			<Button variant="secondary" disabled={busy !== null} on:click={() => checkout('lifetime')}>
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

{#if billingProfile}
	<dialog bind:this={billingDialog} class="billing-dialog" on:cancel|preventDefault={closeBillingModal}>
		<h2>Billing address for invoice</h2>
		<p class="dialog-intro">
			We need this once for your GST tax invoice. It's saved on your account — renewals won't ask
			again unless you change it in Settings.
		</p>
		<BillingAddressForm
			compact
			profile={billingProfile}
			states={billingStates}
			busy={billingBusy}
			submitLabel="Save & continue to payment"
			on:save={onBillingSave}
		/>
		<button type="button" class="dialog-close" on:click={closeBillingModal}>Cancel</button>
	</dialog>
{/if}

<style>
	.upgrade {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		margin-bottom: var(--space-3);
		box-shadow: var(--shadow-xs);
	}
	.upgrade strong {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: var(--space-1);
	}
	.context {
		margin: var(--space-1) 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.features {
		list-style: none;
		margin: var(--space-3) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.features li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--color-text);
	}
	.features li::before {
		content: '';
		flex-shrink: 0;
		width: 0.35rem;
		height: 0.35rem;
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
		border-radius: var(--radius-sm);
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		background: var(--color-primary);
		color: #fff;
		line-height: 1.2;
	}
	.price {
		margin: var(--space-3) 0 0 !important;
		color: var(--color-text) !important;
		font-size: 0.8125rem !important;
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.hint {
		font-size: 0.75rem !important;
		margin-top: var(--space-2) !important;
		color: var(--color-muted);
		line-height: 1.45;
	}
	code {
		font-size: 0.8125rem;
	}
	.billing-dialog {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: var(--space-4) var(--space-5) var(--space-3);
		max-width: min(28rem, calc(100vw - 2rem));
		width: 100%;
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-md);
	}
	.billing-dialog::backdrop {
		background: rgba(15, 23, 42, 0.45);
	}
	.billing-dialog h2 {
		margin: 0 0 var(--space-1);
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.dialog-intro {
		margin: 0 0 var(--space-3);
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.dialog-close {
		margin-top: var(--space-3);
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		padding: var(--space-1) 0;
	}
</style>
