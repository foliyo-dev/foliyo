<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import UpgradePrompt from '$lib/components/UpgradePrompt.svelte';
	import { getPlan, isProPlan, type PlanInfo } from '$lib/api/plan';
	import { isSaas, privacyUrl } from '$lib/config';
	import {
		downloadExport,
		getConsents,
		requestDelete,
		type ConsentRow
	} from '$lib/api/cloud';
	import { logout, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	let loading = true;
	let planInfo: PlanInfo | null = null;
	let accountBusy = false;
	let privacyConsent: ConsentRow | null = null;
	let accountPrivacy = false;
	let deleteConfirm = '';

	$: pro = isProPlan(planInfo?.plan ?? $user?.plan);
	/** Hosted account APIs available (cloud), or explicit SaaS build. */
	$: showDpdp =
		isSaas || accountPrivacy || Boolean(planInfo && planInfo.plan !== 'selfhost');

	onMount(async () => {
		try {
			try {
				planInfo = await getPlan();
			} catch {
				planInfo = null;
			}
			try {
				const c = await getConsents();
				privacyConsent = c.privacy_policy;
				accountPrivacy = true;
			} catch {
				privacyConsent = null;
				accountPrivacy = false;
			}
		} catch {
			showToast('Failed to load settings', 'error');
		} finally {
			loading = false;
		}
	});

	async function exportData() {
		accountBusy = true;
		try {
			await downloadExport();
			showToast('Export downloaded', 'success');
		} catch {
			showToast('Failed to export data', 'error');
		} finally {
			accountBusy = false;
		}
	}

	async function deleteAccount() {
		if (deleteConfirm !== 'DELETE') {
			showToast('Type DELETE to confirm', 'error');
			return;
		}
		accountBusy = true;
		try {
			const res = await requestDelete();
			showToast(res.message, 'success');
			await logout();
			goto('/login');
		} catch {
			showToast('Failed to request deletion', 'error');
		} finally {
			accountBusy = false;
		}
	}

	function formatConsentDate(iso: string | undefined): string {
		if (!iso) return '—';
		try {
			return new Date(iso).toLocaleString();
		} catch {
			return iso;
		}
	}
</script>

<PageHeader title="Settings" description="Plan, billing, and account privacy." />

{#if loading}
	<p class="muted">Loading…</p>
{:else}
	<Card>
		<h2 class="section-title">Plan</h2>
		<p class="muted">
			Current plan: <strong>{planInfo?.plan ?? $user?.plan ?? 'free'}</strong>
			{#if planInfo?.entitlements}
				· PDF {planInfo.entitlements.pdf_export ? 'on' : 'off'}
				· Branding {planInfo.entitlements.remove_branding ? 'removed' : 'shown'}
				· Portfolios {planInfo.entitlements.portfolios_unlimited ? 'unlimited' : `max ${planInfo.entitlements.portfolio_limit}`}
			{/if}
		</p>
		{#if !pro && showDpdp}
			<UpgradePrompt
				title="Upgrade to Pro"
				message="Unlimited portfolios and remove “Made with Foliyo” branding from public pages."
				pricing={planInfo?.pricing ?? null}
				billingAvailable={planInfo?.billing_available ?? false}
				on:upgraded={(e) => {
					planInfo = e.detail;
				}}
			/>
		{:else if pro && showDpdp}
			<p class="ok">Pro active — branding removed on public pages; unlimited portfolios.</p>
		{:else}
			<p class="ok">Self-host — all features unlocked.</p>
		{/if}
	</Card>

	{#if showDpdp}
		<Card>
			<h2 class="section-title">Privacy &amp; data (DPDP)</h2>
			{#if privacyConsent}
				<p class="muted">
					Privacy Policy consent:
					<strong>{privacyConsent.granted ? 'Granted' : 'Revoked'}</strong>
					on {formatConsentDate(privacyConsent.created_at)}.
					<a href={privacyUrl} target="_blank" rel="noreferrer">Read policy</a>
				</p>
			{:else}
				<p class="muted">
					No consent record on file.
					<a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a>
				</p>
			{/if}
			<div class="actions account-actions">
				<Button variant="ghost" disabled={accountBusy} on:click={exportData}>
					Download my data
				</Button>
			</div>
			<div class="danger">
				<p class="muted">
					Delete your account after a 30-day grace period. Type <strong>DELETE</strong> to confirm.
					You will be signed out immediately.
				</p>
				<Input label="Confirm deletion" bind:value={deleteConfirm} placeholder="DELETE" />
				<div class="actions account-actions">
					<Button variant="ghost" disabled={accountBusy || deleteConfirm !== 'DELETE'} on:click={deleteAccount}>
						Delete account
					</Button>
				</div>
			</div>
		</Card>
	{/if}
{/if}

<style>
	.muted {
		color: var(--color-muted);
	}
	.ok {
		margin: 0.75rem 0 0;
		font-size: 0.875rem;
		color: #166534;
	}
	.actions {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
	.section-title {
		margin: 0 0 0.75rem;
		font-size: 1.125rem;
	}
	.account-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		border-top: none;
		padding-top: 0;
		margin-top: 1rem;
	}
	.danger {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
</style>
