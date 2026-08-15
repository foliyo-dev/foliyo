<script lang="ts">
	import { onMount } from 'svelte';
	import { getPlan, type PlanInfo } from '$lib/api/plan';

	let planInfo: PlanInfo | null = null;
	let dismissedKey = '';

	onMount(async () => {
		try {
			planInfo = await getPlan();
		} catch {
			planInfo = null;
		}
	});

	/** `plan_expires` is `YYYY-MM-DD HH:MM:SS` UTC (no timezone suffix). */
	function parseUtc(stamp: string): Date {
		return new Date(`${stamp.replace(' ', 'T')}Z`);
	}

	$: expiresAt = planInfo?.plan_expires ? parseUtc(planInfo.plan_expires) : null;
	$: msLeft = expiresAt ? expiresAt.getTime() - Date.now() : null;
	$: daysLeft = msLeft !== null ? Math.ceil(msLeft / 86_400_000) : null;
	$: onTrial = Boolean(planInfo?.on_trial);
	$: trialEnded = Boolean(planInfo?.trial_ended);

	// Only hosted Pro plans expire; lifetime/free/selfhost never carry a plan_expires date here.
	$: isExpired = Boolean(
		planInfo?.billing_available &&
			expiresAt &&
			msLeft !== null &&
			msLeft <= 0 &&
			(planInfo?.plan === 'pro' || trialEnded)
	);
	$: isExpiringSoon = Boolean(
		planInfo?.billing_available &&
			planInfo?.plan === 'pro' &&
			daysLeft !== null &&
			daysLeft >= 0 &&
			daysLeft <= 7
	);

	$: dateLabel = expiresAt
		? expiresAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
		: '';
	$: bannerKey = planInfo?.plan_expires ?? '';
	$: show = (isExpired || isExpiringSoon) && dismissedKey !== bannerKey;
</script>

{#if show}
	<div class="plan-banner" class:expired={isExpired} role="status">
		<div class="text">
			{#if isExpired}
				<strong
					>{onTrial || trialEnded
						? `Your Pro trial ended on ${dateLabel}`
						: `Your Pro plan expired on ${dateLabel}`}</strong
				>
				<p>
					We don't auto-charge your card, so nothing renewed automatically. Upgrade from Settings to
					restore unlimited portfolios, PDF export, and AI tools.
				</p>
			{:else if onTrial}
				<strong
					>Pro trial ends in {daysLeft} day{daysLeft === 1 ? '' : 's'} ({dateLabel})</strong
				>
				<p>
					You're on a 7-day Pro trial — try PDF export, unlimited publish slots, branding removal,
					and AI tools. Upgrade anytime to keep Pro after the trial; we never auto-charge.
				</p>
			{:else}
				<strong>Pro expires in {daysLeft} day{daysLeft === 1 ? '' : 's'} ({dateLabel})</strong>
				<p>
					Foliyo never auto-charges your card — you'll need to renew manually to keep Pro. We'll
					also email a reminder.
				</p>
			{/if}
		</div>
		<div class="actions">
			<a class="renew" href="/settings">{onTrial && !isExpired ? 'Upgrade' : 'Renew'}</a>
			<button class="dismiss" type="button" on:click={() => (dismissedKey = bannerKey)}
				>Dismiss</button
			>
		</div>
	</div>
{/if}

<style>
	.plan-banner {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 0 1.25rem;
		padding: 0.85rem 1.1rem;
		border: 1px solid #f59e0b;
		border-radius: 8px;
		background: #fffbeb;
	}
	.plan-banner.expired {
		border-color: #dc2626;
		background: #fef2f2;
	}
	.text strong {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.9rem;
	}
	.text p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.renew {
		flex-shrink: 0;
		padding: 0.4rem 0.85rem;
		border-radius: 6px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}
	.dismiss {
		flex-shrink: 0;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0.25rem;
	}

	@media (max-width: 560px) {
		.plan-banner {
			flex-direction: column;
		}
	}
</style>
