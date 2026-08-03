<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import UpgradePrompt from '$lib/components/UpgradePrompt.svelte';
	import {
		getSettings,
		updateSettings,
		portfolioThemes,
		resumeThemes,
		type Settings
	} from '$lib/api/settings';
	import { getPlan, isProPlan, type PlanInfo } from '$lib/api/plan';
	import { isSaas } from '$lib/config';
	import {
		downloadExport,
		getConsents,
		requestDelete,
		type ConsentRow
	} from '$lib/api/cloud';
	import { logout, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	let loading = true;
	let saving = false;
	let planInfo: PlanInfo | null = null;
	let accountBusy = false;
	let privacyConsent: ConsentRow | null = null;
	let deleteConfirm = '';
	let settings: Settings = {
		site_title: 'My Portfolio',
		site_description: '',
		theme_slug: 'minimal',
		resume_theme: 'classic',
		custom_domain: '',
		seo_keywords: ''
	};

	$: pro = isProPlan(planInfo?.plan ?? $user?.plan);

	onMount(async () => {
		try {
			settings = await getSettings();
			try {
				planInfo = await getPlan();
			} catch {
				planInfo = null;
			}
			if (isSaas) {
				try {
					const c = await getConsents();
					privacyConsent = c.privacy_policy;
				} catch {
					privacyConsent = null;
				}
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
			goto('/signup');
		} catch {
			showToast('Failed to request deletion', 'error');
		} finally {
			accountBusy = false;
		}
	}

	async function save() {
		saving = true;
		try {
			settings = await updateSettings({
				site_title: settings.site_title,
				site_description: settings.site_description,
				theme_slug: settings.theme_slug,
				resume_theme: settings.resume_theme,
				custom_domain: settings.custom_domain,
				seo_keywords: settings.seo_keywords
			});
			showToast('Settings saved', 'success');
		} catch {
			showToast('Failed to save settings', 'error');
		} finally {
			saving = false;
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

<PageHeader title="Settings" description="Site title, themes, SEO, plan, and custom domain." />

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
		{#if !pro}
			<UpgradePrompt
				title="Upgrade to Pro"
				message="Unlimited portfolios and remove “Made with Foliyo” branding from public pages."
				pricing={planInfo?.pricing ?? null}
				billingAvailable={planInfo?.billing_available ?? false}
				on:upgraded={(e) => {
					planInfo = e.detail;
				}}
			/>
		{:else}
			<p class="ok">Pro active — branding removed on public pages; unlimited portfolios.</p>
		{/if}
	</Card>

	<Card>
		<div class="fields">
			<Input label="Site title" bind:value={settings.site_title} />
			<Textarea label="Site description" bind:value={settings.site_description} rows={3} />
			<label class="field">
				<span class="label">Portfolio theme</span>
				<select bind:value={settings.theme_slug}>
					{#each portfolioThemes as theme}
						<option value={theme}>{theme}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span class="label">Resume theme</span>
				<select bind:value={settings.resume_theme}>
					{#each resumeThemes as theme}
						<option value={theme}>{theme}</option>
					{/each}
				</select>
			</label>
			<Input label="Custom domain" bind:value={settings.custom_domain} placeholder="portfolio.example.com" />
			<Input label="SEO keywords" bind:value={settings.seo_keywords} placeholder="developer, portfolio" />
		</div>
		<div class="actions">
			<Button disabled={saving} on:click={save}>{saving ? 'Saving…' : 'Save settings'}</Button>
		</div>
	</Card>

	{#if isSaas}
		<Card>
			<h2 class="section-title">Privacy &amp; data (DPDP)</h2>
			{#if privacyConsent}
				<p class="muted">
					Privacy Policy consent:
					<strong>{privacyConsent.granted ? 'Granted' : 'Revoked'}</strong>
					on {formatConsentDate(privacyConsent.created_at)}.
					<a href="https://foliyo.dev/privacy" target="_blank" rel="noreferrer">Read policy</a>
				</p>
			{:else}
				<p class="muted">
					No consent record on file.
					<a href="https://foliyo.dev/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
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
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
	}
	select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
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
