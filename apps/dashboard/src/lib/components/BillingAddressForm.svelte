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
		margin: 0 0 1rem;
		font-size: 0.875rem;
		line-height: 1.45;
	}
	.grid {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.row-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}
	select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.9375rem;
	}
	select:focus {
		border-color: var(--color-primary-muted);
		box-shadow: 0 0 0 3px var(--color-primary-light);
		outline: none;
	}
	.actions {
		margin-top: 1rem;
	}
	@media (max-width: 520px) {
		.row-2 {
			grid-template-columns: 1fr;
		}
	}
</style>
