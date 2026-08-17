<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import UpgradePrompt from '$lib/components/UpgradePrompt.svelte';
	import { formatPlanLabel, getPlan, isProPlan, type PlanInfo } from '$lib/api/plan';
	import { getAiUsage, type AiUsage } from '$lib/api/ai';
	import { isSaas, privacyUrl, publicHost, publicPortfolioPath } from '$lib/config';
	import {
		checkHandle,
		claimHandle,
		downloadExport,
		getConsents,
		requestDelete,
		type ConsentRow
	} from '$lib/api/cloud';
	import { ApiError } from '$lib/api/client';
	import { changePassword, logout, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	let loading = true;
	let planInfo: PlanInfo | null = null;
	let aiUsage: AiUsage | null = null;
	let accountBusy = false;
	let privacyConsent: ConsentRow | null = null;
	let accountPrivacy = false;
	let deleteConfirm = '';

	/** Same rules as cloud `/api/handle`. */
	const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;
	/** Matches `HANDLE_CHANGE_COOLDOWN_DAYS` in foliyo-cloud's handle route. */
	const HANDLE_COOLDOWN_DAYS = 30;

	let editingHandle = false;
	let handleInput = '';
	let handleChecking = false;
	let handleAvailable: boolean | null = null;
	let handleFormatError: string | null = null;
	let handleSaving = false;
	let handleCheckTimer: ReturnType<typeof setTimeout> | undefined;
	let handleCheckSeq = 0;

	$: host = publicHost();
	$: handleCooldownUntil = (() => {
		const changedAt = $user?.handle_changed_at;
		if (!changedAt) return null;
		const until = new Date(new Date(changedAt).getTime() + HANDLE_COOLDOWN_DAYS * 86_400_000);
		return until > new Date() ? until : null;
	})();

	function startEditHandle() {
		handleInput = $user?.handle ?? '';
		handleAvailable = null;
		handleFormatError = null;
		editingHandle = true;
	}

	function cancelEditHandle() {
		editingHandle = false;
		clearTimeout(handleCheckTimer);
	}

	function scheduleHandleCheck(raw: string) {
		const h = raw.toLowerCase().trim();
		clearTimeout(handleCheckTimer);
		if (!h || h === ($user?.handle ?? '')) {
			handleAvailable = null;
			handleFormatError = null;
			return;
		}
		if (!HANDLE_RE.test(h)) {
			handleAvailable = false;
			handleFormatError =
				h.length < 3
					? 'Handle must be at least 3 characters'
					: 'Use lowercase letters, numbers, _ or - (start with a letter or number)';
			return;
		}
		handleFormatError = null;
		handleCheckTimer = setTimeout(() => void runHandleCheck(h), 300);
	}

	$: if (editingHandle) scheduleHandleCheck(handleInput);

	async function runHandleCheck(h: string) {
		const seq = ++handleCheckSeq;
		handleChecking = true;
		try {
			const res = await checkHandle(h);
			if (seq !== handleCheckSeq) return;
			handleAvailable = res.available;
			if (!res.available && res.reason) {
				handleFormatError =
					res.reason === 'reserved' || res.reason === 'temp_prefix_reserved'
						? 'That handle is reserved'
						: 'Unavailable (taken or reserved)';
			}
		} catch {
			if (seq !== handleCheckSeq) return;
			handleAvailable = null;
			handleFormatError = 'Could not check availability — try again';
		} finally {
			if (seq === handleCheckSeq) handleChecking = false;
		}
	}

	function apiErrorMessage(err: unknown, fallback: string): string {
		if (!(err instanceof ApiError)) return fallback;
		try {
			const body = JSON.parse(err.message) as { error?: string; retry_at?: string };
			if (body.error === 'handle taken') return 'That handle was just taken';
			if (body.error === 'handle reserved') return 'That handle is reserved';
			if (body.error === 'invalid handle') return 'Invalid handle format';
			if (body.error === 'handle cooldown') {
				const when = body.retry_at ? new Date(body.retry_at).toLocaleDateString() : 'later';
				return `You can change your handle again on ${when}`;
			}
			if (body.error) return body.error;
		} catch {
			/* plain text */
		}
		return fallback;
	}

	async function saveHandle() {
		const h = handleInput.toLowerCase().trim();
		if (h === ($user?.handle ?? '')) {
			editingHandle = false;
			return;
		}
		if (!HANDLE_RE.test(h) || handleAvailable !== true) {
			showToast(handleFormatError || 'Choose an available handle', 'error');
			return;
		}
		handleSaving = true;
		try {
			const res = await claimHandle(h);
			user.update((u) =>
				u ? { ...u, handle: res.handle, handle_changed_at: new Date().toISOString() } : u
			);
			showToast(`Your link is now /u/${res.handle}`, 'success');
			editingHandle = false;
		} catch (err) {
			showToast(apiErrorMessage(err, 'Could not save handle'), 'error');
		} finally {
			handleSaving = false;
		}
	}

	async function copyPublicLink() {
		const h = $user?.handle;
		if (!h) return;
		try {
			await navigator.clipboard.writeText(publicPortfolioPath(h));
			showToast('Link copied', 'success');
		} catch {
			showToast('Could not copy link', 'error');
		}
	}

	onDestroy(() => clearTimeout(handleCheckTimer));

	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let passwordSaving = false;

	$: canChangePassword =
		currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

	async function submitChangePassword() {
		if (newPassword.length < 8) {
			showToast('New password must be at least 8 characters', 'error');
			return;
		}
		if (newPassword !== confirmPassword) {
			showToast('New passwords do not match', 'error');
			return;
		}
		passwordSaving = true;
		try {
			await changePassword(currentPassword, newPassword);
			showToast('Password changed', 'success');
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (err) {
			const message =
				err instanceof ApiError && err.status === 401
					? 'Current password is incorrect'
					: 'Could not change password';
			showToast(message, 'error');
		} finally {
			passwordSaving = false;
		}
	}

	$: planSlug = planInfo?.plan ?? $user?.plan ?? (isSaas ? 'free' : 'selfhost');
	$: onTrial = Boolean(planInfo?.on_trial);
	$: trialEnded = Boolean(planInfo?.trial_ended);
	$: planLabel = formatPlanLabel(planSlug, { onTrial });
	$: pro = isProPlan(planSlug);
	/** Hosted account APIs available (cloud), or explicit SaaS build. */
	$: showDpdp =
		isSaas || accountPrivacy || Boolean(planInfo && planInfo.plan !== 'selfhost');

	/** `plan_expires` is `YYYY-MM-DD HH:MM:SS` UTC (no timezone suffix). */
	function formatExpiry(stamp: string): string {
		return new Date(`${stamp.replace(' ', 'T')}Z`).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
	$: planExpiresLabel = planInfo?.plan_expires ? formatExpiry(planInfo.plan_expires) : '';
	$: daysUntilExpiry = planInfo?.plan_expires
		? Math.ceil(
				(new Date(`${planInfo.plan_expires.replace(' ', 'T')}Z`).getTime() - Date.now()) /
					86_400_000
			)
		: null;
	// Only monthly Pro carries an expiry; surface a renew action once it's close (or past) to
	// avoid tempting an early renewal that would reset — rather than extend — the 30-day clock.
	$: renewalDueSoon = pro && planSlug === 'pro' && daysUntilExpiry !== null && daysUntilExpiry <= 7;

	onMount(async () => {
		try {
			try {
				planInfo = await getPlan();
			} catch {
				planInfo = null;
			}
			if (isSaas) {
				try {
					aiUsage = await getAiUsage();
				} catch {
					aiUsage = null;
				}
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

<PageHeader title="Settings" description="Account, plan, billing, and privacy." />

{#if loading}
	<p class="muted">Loading…</p>
{:else}
	<Card>
		<h2 class="section-title">Account</h2>
		<p class="muted">
			Email: <strong>{$user?.email ?? '—'}</strong>
		</p>
		{#if $user?.handle}
			{#if editingHandle}
				<div class="handle-edit">
					<div class="handle-field">
						<span class="prefix">{host}/u/</span>
						<Input label="" bind:value={handleInput} placeholder="yourname" autocomplete="username" />
					</div>
					{#if handleFormatError && handleInput.trim()}
						<p class="taken status">{handleFormatError}</p>
					{:else if handleChecking}
						<p class="muted status">Checking…</p>
					{:else if handleAvailable === true}
						<p class="ok status">
							Available — {host}/u/{handleInput.toLowerCase().trim()}
						</p>
					{:else if handleAvailable === false}
						<p class="taken status">Unavailable (taken or reserved)</p>
					{/if}
					<div class="actions account-actions">
						<Button
							disabled={handleSaving || (handleInput.toLowerCase().trim() !== $user.handle && handleAvailable !== true)}
							on:click={saveHandle}
						>
							{handleSaving ? 'Saving…' : 'Save'}
						</Button>
						<Button variant="ghost" disabled={handleSaving} on:click={cancelEditHandle}>Cancel</Button>
					</div>
				</div>
			{:else}
				<p class="muted">
					Public link: <strong>{host}/u/{$user.handle}</strong>
					<button type="button" class="link-btn" on:click={copyPublicLink}>Copy</button>
					{#if isSaas}
						{#if handleCooldownUntil}
							<span class="cooldown-hint"
								>Can change again on {handleCooldownUntil.toLocaleDateString()}</span
							>
						{:else}
							<button type="button" class="link-btn" on:click={startEditHandle}>Change</button>
						{/if}
					{/if}
				</p>
			{/if}
		{/if}
	</Card>

	<Card>
		<h2 class="section-title">Plan</h2>
		<p class="muted">
			Current plan:
			<strong class:plan-pro={planSlug === 'pro' || planSlug === 'lifetime'}>{planLabel}</strong>
			{#if planInfo?.entitlements}
				· PDF {planInfo.entitlements.pdf_export ? 'on' : 'off'}
				· Branding {planInfo.entitlements.remove_branding ? 'removed' : 'shown'}
				· Portfolios {planInfo.entitlements.portfolios_unlimited ? 'unlimited' : `max ${planInfo.entitlements.portfolio_limit}`}
				· Resumes {planInfo.entitlements.resume_limit == null ? 'unlimited' : `max ${planInfo.entitlements.resume_limit}`}
				· Import resume {planInfo.entitlements.ai_resume_import ? 'on' : 'off'}
				· AI assist {(planInfo.entitlements.ai_assist ?? planInfo.entitlements.ai_resume_import) ? 'on' : 'off'}
			{/if}
		</p>
		{#if isSaas && pro && aiUsage}
			<p class="muted">
				Daily AI budget:
				<strong>{aiUsage.remaining} of {aiUsage.limit} units left</strong>
				({aiUsage.units} used today). Smarter JD parse and rewrite cost {aiUsage.costs.analyze ?? 1} unit;
				resume import costs {aiUsage.costs.import}. Resets midnight UTC.
			</p>
		{:else if isSaas && !pro}
			<p class="muted">
				Pro includes a daily AI unit budget for smarter JD parse, rewrite, and resume import.
			</p>
		{/if}
		{#if !pro && showDpdp}
			{#if trialEnded}
				<p class="muted">
					Your 7-day Pro trial has ended. Upgrade to restore unlimited portfolios, PDF export,
					branding removal, and AI tools.
				</p>
			{/if}
			<UpgradePrompt
				title="Upgrade to Pro"
				pricing={planInfo?.pricing ?? null}
				billingAvailable={planInfo?.billing_available ?? false}
				on:upgraded={async (e) => {
					planInfo = e.detail;
					if (isSaas) {
						try {
							aiUsage = await getAiUsage();
						} catch {
							aiUsage = null;
						}
					}
				}}
			/>
		{:else if planSlug === 'lifetime' && showDpdp}
			<p class="ok">
				Lifetime active — unlimited publish slots, PDF export, branding removed, import resume &amp;
				rewrite unlocked.
			</p>
		{:else if pro && showDpdp}
			{#if onTrial}
				<p class="ok">
					7-day Pro trial active — unlimited publish slots, PDF export, branding removed, import resume
					&amp; rewrite unlocked.
				</p>
				{#if planExpiresLabel}
					<p class="muted">
						Trial ends <strong>{planExpiresLabel}</strong>. Upgrade anytime to keep Pro — we never
						auto-charge
						{#if daysUntilExpiry !== null && daysUntilExpiry >= 0}
							({daysUntilExpiry} day{daysUntilExpiry === 1 ? '' : 's'} left){/if}.
					</p>
				{/if}
			{:else}
				<p class="ok">
					Pro active — unlimited publish slots, PDF export, branding removed, import resume &amp; rewrite
					unlocked.
				</p>
				{#if planExpiresLabel}
					<p class="muted">
						Valid through <strong>{planExpiresLabel}</strong>. We don't auto-charge your card — renew
						manually anytime before then to keep Pro
						{#if daysUntilExpiry !== null && daysUntilExpiry >= 0}(we'll also email a reminder {daysUntilExpiry >
							7
							? 'a week before it expires'
							: `— ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} left`}){/if}.
					</p>
				{/if}
			{/if}
			{#if renewalDueSoon}
				<UpgradePrompt
					title={onTrial
						? daysUntilExpiry !== null && daysUntilExpiry < 0
							? 'Trial ended — upgrade'
							: 'Keep Pro after trial'
						: daysUntilExpiry !== null && daysUntilExpiry < 0
							? 'Pro expired — renew'
							: 'Renew Pro'}
					message={onTrial
						? 'Upgrade to Pro ₹99/mo (30 days) or Lifetime. Paying replaces the trial clock with a fresh paid period.'
						: "Renewing sets a fresh 30 days from today (it doesn't stack with time left), so renew close to your expiry date."}
					showFeatures={!onTrial}
					pricing={planInfo?.pricing ?? null}
					billingAvailable={planInfo?.billing_available ?? false}
					on:upgraded={(e) => {
						planInfo = e.detail;
					}}
				/>
			{/if}
		{:else}
			<p class="ok">Self-host — all features unlocked.</p>
		{/if}
	</Card>

	<Card>
		<h2 class="section-title">Password</h2>
		<p class="muted">Change your password. This signs you out of other devices.</p>
		<div class="fields">
			<Input
				label="Current password"
				type="password"
				bind:value={currentPassword}
				autocomplete="current-password"
			/>
			<Input
				label="New password"
				type="password"
				bind:value={newPassword}
				autocomplete="new-password"
			/>
			<Input
				label="Confirm new password"
				type="password"
				bind:value={confirmPassword}
				autocomplete="new-password"
			/>
		</div>
		<div class="actions account-actions">
			<Button disabled={!canChangePassword || passwordSaving} on:click={submitChangePassword}>
				{passwordSaving ? 'Saving…' : 'Change password'}
			</Button>
		</div>
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
	.plan-pro {
		color: var(--color-primary);
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
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}
	.link-btn {
		margin-left: 0.5rem;
		border: none;
		background: transparent;
		color: var(--color-primary);
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}
	.link-btn:hover {
		color: var(--color-primary-hover);
	}
	.cooldown-hint {
		margin-left: 0.5rem;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.handle-edit {
		margin-top: 0.75rem;
	}
	.handle-field {
		margin-bottom: 0.5rem;
	}
	.prefix {
		display: block;
		font-size: 0.875rem;
		color: var(--color-muted);
		margin-bottom: 0.35rem;
	}
	.status {
		font-size: 0.875rem;
		margin: 0 0 0.75rem;
	}
	.taken {
		color: var(--color-error);
	}
</style>
