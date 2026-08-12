<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { resendVerification } from '$lib/api/cloud';
	import {
		loadSession,
		needsEmailVerification,
		postAuthPath,
		user
	} from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	let loading = true;
	let resending = false;
	let email = '';

	async function init() {
		const ok = await loadSession();
		if (!ok) {
			goto('/login');
			return;
		}
		const u = get(user);
		if (!needsEmailVerification(u) && u) {
			goto(postAuthPath(u));
			return;
		}
		email = u?.email ?? '';
		loading = false;
	}

	async function handleResend() {
		resending = true;
		try {
			await resendVerification();
			showToast('Verification email resent — check your inbox (and spam)', 'success');
		} catch {
			showToast('Could not resend email', 'error');
		} finally {
			resending = false;
		}
	}

	init();
</script>

<svelte:head>
	<title>Check your email · Foliyo</title>
</svelte:head>

<div class="auth-page">
	<Card>
		{#if loading}
			<p class="muted">Loading…</p>
		{:else}
			<h1>Check your email</h1>
			<p class="muted">
				We sent a verification link to <strong>{email}</strong>. Click it to unlock your account.
			</p>
			<Button disabled={resending} on:click={handleResend}>
				{resending ? 'Sending…' : 'Resend email'}
			</Button>
			<p class="footer muted">
				<a href="/login">Sign in</a>
				· Wrong address? <a href="/signup">Sign up again</a>
			</p>
		{/if}
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
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
	}
	.muted {
		color: var(--color-muted);
	}
	.footer {
		margin-top: 1.25rem;
		text-align: center;
		font-size: 0.875rem;
	}
</style>
