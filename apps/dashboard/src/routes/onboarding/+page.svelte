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
	import Card from '$lib/components/ui/Card.svelte';

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
			goto('/');
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
			goto('/');
		} catch {
			showToast('Could not continue', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="auth-page">
	<Card>
		<h1>Choose your public URL</h1>
		{#if tempHandle}
			<p class="muted">
				Your link is <strong>{host}/u/{tempHandle}</strong> (name + signup date). Claim a shorter
				handle anytime, or keep this one.
			</p>
		{:else}
			<p class="muted">Your portfolio will be at <strong>{host}/u/{preview}</strong></p>
		{/if}

		<div class="handle-field">
			<span class="prefix">{host}/u/</span>
			<Input
				label=""
				bind:value={handle}
				placeholder="yourname"
				autocomplete="username"
			/>
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
	</Card>
</div>

<style>
	.auth-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: linear-gradient(160deg, var(--color-primary-light) 0%, var(--color-bg) 45%);
	}
	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.5rem;
	}
	.muted {
		color: var(--color-muted);
		margin: 0 0 1.25rem;
	}
	.handle-field {
		margin-bottom: 1rem;
	}
	.prefix {
		display: block;
		font-size: 0.875rem;
		color: var(--color-muted);
		margin-bottom: 0.35rem;
	}
	.status {
		font-size: 0.875rem;
		margin: 0 0 1rem;
	}
	.ok {
		color: var(--color-success);
	}
	.taken {
		color: var(--color-error);
	}
	.skip {
		display: block;
		width: 100%;
		margin-top: 0.75rem;
		padding: 0.5rem;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
	}
	.skip:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
