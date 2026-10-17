<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { BillingPayload, BillingProfile, IndianState } from '$lib/api/billing';

	export let profile: BillingProfile;
	export let states: IndianState[] = [];
	export let busy = false;
	export let submitLabel = 'Save billing address';
	export let compact = false;

	const dispatch = createEventDispatcher<{ save: BillingPayload }>();

	let legalName = profile.legal_name;
	let addressLine1 = profile.address_line1;
	let addressLine2 = profile.address_line2;
	let city = profile.city;
	let pincode = profile.pincode;
	let state = profile.state;
	let gstin = profile.gstin ?? '';

	$: if (profile) {
		legalName = profile.legal_name;
		addressLine1 = profile.address_line1;
		addressLine2 = profile.address_line2;
		city = profile.city;
		pincode = profile.pincode;
		state = profile.state;
		gstin = profile.gstin ?? '';
	}

	function submit() {
		dispatch('save', {
			legal_name: legalName.trim(),
			address_line1: addressLine1.trim(),
			address_line2: addressLine2.trim(),
			city: city.trim(),
			pincode: pincode.trim(),
			state: state.trim(),
			gstin: gstin.trim() || null
		});
	}
</script>

<form class="billing-form" class:compact on:submit|preventDefault={submit}>
	{#if !compact}
		<p class="intro muted">
			Used for GST tax invoices. Saved on your account — we won't ask again on renewals unless you
			change it here.
		</p>
	{/if}
	<div class="grid">
		<Input label="Legal name" bind:value={legalName} autocomplete="name" />
		<Input label="Address line 1" bind:value={addressLine1} autocomplete="street-address" />
		<Input label="Address line 2 (optional)" bind:value={addressLine2} autocomplete="address-line2" />
		<div class="row-2">
			<Input label="City" bind:value={city} autocomplete="address-level2" />
			<Input label="PIN code" bind:value={pincode} autocomplete="postal-code" />
		</div>
		<label>
			<span class="label">State</span>
			<select bind:value={state} required disabled={busy}>
				<option value="" disabled>Select state</option>
				{#each states as s}
					<option value={s.name}>{s.name}</option>
				{/each}
			</select>
		</label>
		<Input
			label="GSTIN (optional — business purchases)"
			bind:value={gstin}
			placeholder="15-character GSTIN"
		/>
	</div>
	<div class="actions">
		<Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
	</div>
</form>

<style>
	.billing-form.compact .intro {
		display: none;
	}
	.intro {
		margin: 0 0 var(--space-3);
		font-size: 0.8125rem;
		line-height: 1.45;
	}
	.grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}
	select {
		min-height: var(--control-height);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
	}
	select:focus {
		border-color: var(--color-primary-muted);
		box-shadow: var(--focus-ring);
		outline: none;
	}
	.actions {
		margin-top: var(--space-3);
	}
	@media (max-width: 520px) {
		.row-2 {
			grid-template-columns: 1fr;
		}
	}
</style>
