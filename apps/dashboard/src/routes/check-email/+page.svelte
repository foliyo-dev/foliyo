<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import Button from '$lib/components/ui/Button.svelte';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import {
		getPendingSignupEmail,
		resendVerification
	} from '$lib/api/cloud';
	import {
		loadSession,
		needsEmailVerification,
		postAuthPath,
		user
	} from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	let loading = $state(true);
	let resending = $state(false);
	let email = $state('');

	async function init() {
		const ok = await loadSession();
		if (ok) {
			const u = get(user);
			if (!needsEmailVerification(u) && u) {
				goto(postAuthPath(u));
				return;
			}
			email = u?.email ?? getPendingSignupEmail();
		} else {
			email = getPendingSignupEmail();
		}
		loading = false;
	}

	async function handleResend() {
		if (!email) {
			showToast('Enter your email on the sign-up page first.', 'error');
			return;
		}
		resending = true;
		try {
			await resendVerification(email);
			showToast('If that email can be used, we sent a link. Check inbox and spam.', 'success');
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

{#if loading}
	<AuthShell description="Loading…" />
{:else}
	<AuthShell title="Check your email">
		<p class="body muted">
			{#if email}
				We sent a link to <strong>{email}</strong> to choose a password. It expires in 60 minutes.
			{:else}
				We sent a link to choose a password. It expires in 60 minutes.
			{/if}
		</p>
		<Button disabled={resending || !email} on:click={handleResend}>
			{resending ? 'Sending…' : 'Resend email'}
		</Button>
		<p class="footer">
			<a href="/login">Sign in</a>
			· Wrong address? <a href="/signup">Sign up again</a>
		</p>
	</AuthShell>
{/if}

<style>
	.body {
		margin: 0 0 var(--space-4);
		text-align: center;
		font-size: 0.875rem;
		line-height: 1.45;
	}
	.muted {
		color: var(--color-muted);
	}
</style>
