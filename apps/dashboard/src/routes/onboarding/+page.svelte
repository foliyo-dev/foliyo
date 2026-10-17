<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';
	import { ApiError } from '$lib/api/client';
	import { checkHandle, claimHandle, skipHandleClaim } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';
	import { publicHost } from '$lib/config';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';

	/** Same rules as cloud `/api/handle` (lowercase, 3–32 chars). */
	const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;

	let handle = '';
	let checking = false;
	let available: boolean | null = null;
	let formatError: string | null = null;
	let saving = false;
	let checkTimer: ReturnType<typeof setTimeout> | undefined;
	let checkSeq = 0;

	$: host = publicHost();
	$: tempHandle = $user?.handle ?? '';
	$: preview = (handle.trim() || tempHandle || 'you').toLowerCase();
	$: canClaim = Boolean(handle.trim()) && available === true && !checking && !saving;
	$: scheduleAvailabilityCheck(handle);

	onDestroy(() => clearTimeout(checkTimer));

	function scheduleAvailabilityCheck(raw: string) {
		const h = raw.toLowerCase().trim();
		clearTimeout(checkTimer);
		if (!h) {
			available = null;
			formatError = null;
			return;
		}
		if (!HANDLE_RE.test(h)) {
			available = false;
			formatError =
				h.length < 3
					? 'Handle must be at least 3 characters'
					: 'Use lowercase letters, numbers, _ or - (start with a letter or number)';
			return;
		}
		formatError = null;
		checkTimer = setTimeout(() => {
			void runCheck(h);
		}, 300);
	}

	async function runCheck(h: string) {
		const seq = ++checkSeq;
		checking = true;
		try {
			const res = await checkHandle(h);
			if (seq !== checkSeq) return;
			available = res.available;
			if (!res.available && res.reason) {
				formatError =
					res.reason === 'reserved' || res.reason === 'temp_prefix_reserved'
						? 'That handle is reserved'
						: 'Unavailable (taken or reserved)';
			}
		} catch {
			if (seq !== checkSeq) return;
			available = null;
			formatError = 'Could not check availability — try again';
		} finally {
			if (seq === checkSeq) checking = false;
		}
	}

	function apiErrorMessage(err: unknown, fallback: string): string {
		if (!(err instanceof ApiError)) return fallback;
		try {
			const body = JSON.parse(err.message) as { error?: string; reason?: string };
			if (body.error === 'handle taken') return 'That handle was just taken';
			if (body.error === 'handle reserved') return 'That handle is reserved';
			if (body.error === 'invalid handle') return 'Invalid handle format';
			if (body.error) return body.error;
		} catch {
			/* plain text */
		}
		return fallback;
	}

	async function finish() {
		const h = handle.toLowerCase().trim();
		if (!HANDLE_RE.test(h) || available !== true) {
			showToast(formatError || 'Choose an available handle', 'error');
			return;
		}
		saving = true;
		try {
			const res = await claimHandle(h);
			user.update((u) => (u ? { ...u, handle: res.handle, onboarding_complete: 1 } : u));
			showToast(`Claimed /u/${res.handle}`, 'success');
			goto('/?start=1');
		} catch (err) {
			showToast(apiErrorMessage(err, 'Could not save handle'), 'error');
		} finally {
			saving = false;
		}
	}

	async function skip() {
		saving = true;
		try {
			const res = await skipHandleClaim();
			user.update((u) =>
				u ? { ...u, handle: res.handle ?? u.handle, onboarding_complete: 1 } : u
			);
			goto('/?start=1');
		} catch {
			showToast('Could not continue', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Claim your handle · Foliyo</title>
</svelte:head>

<AuthShell title="Choose your public URL">
	{#if tempHandle}
		<p class="lead muted">
			Your link is <strong>{host}/u/{tempHandle}</strong> (name + signup date). Claim a shorter
			handle anytime, or keep this one.
		</p>
	{:else}
		<p class="lead muted">Your portfolio will be at <strong>{host}/u/{preview}</strong></p>
	{/if}

	<div class="handle-field">
		<span class="prefix">{host}/u/</span>
		<Input label="" bind:value={handle} placeholder="yourname" autocomplete="username" />
	</div>

	{#if formatError && handle.trim()}
		<p class="taken status">{formatError}</p>
	{:else if checking}
		<p class="muted status">Checking…</p>
	{:else if available === true}
		<p class="ok status">Available — {host}/u/{handle.toLowerCase().trim()}</p>
	{:else if available === false}
		<p class="taken status">Unavailable (taken or reserved)</p>
	{/if}

	<Button disabled={!canClaim} on:click={finish}>
		{saving ? 'Saving…' : 'Claim handle'}
	</Button>
	<button type="button" class="skip" disabled={saving} on:click={skip}>
		Skip — keep {tempHandle || 'current URL'}
	</button>
</AuthShell>

<style>
	.lead {
		margin: 0 0 var(--space-4);
		text-align: center;
		font-size: 0.875rem;
		line-height: 1.45;
	}
	.muted {
		color: var(--color-muted);
	}
	.handle-field {
		margin-bottom: var(--space-3);
	}
	.prefix {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-muted);
		margin-bottom: var(--space-1);
	}
	.status {
		font-size: 0.8125rem;
		margin: 0 0 var(--space-3);
		text-align: center;
	}
	.ok {
		color: var(--color-success-text);
	}
	.taken {
		color: var(--color-error);
	}
	.skip {
		display: block;
		width: 100%;
		margin-top: var(--space-3);
		padding: var(--space-2);
		border: none;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		text-decoration: underline;
	}
	.skip:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
