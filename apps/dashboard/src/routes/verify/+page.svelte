<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { verifyEmail } from '$lib/api/cloud';
	import { accessToken } from '$lib/stores/token';
	import { postAuthPath, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	let status: 'working' | 'ok' | 'error' = 'working';
	let error = '';

	onMount(async () => {
		// Prefer live location — session bootstrap must not strip ?token= on /verify.
		const token =
			new URL(window.location.href).searchParams.get('token') ??
			$page.url.searchParams.get('token');
		if (!token) {
			status = 'error';
			error = 'Missing verification token.';
			return;
		}
		try {
			const data = await verifyEmail(token);
			accessToken.set(data.token);
			user.set(data.user);
			status = 'ok';
			showToast('Email verified', 'success');
			goto(postAuthPath(data.user));
		} catch {
			status = 'error';
			error = 'This link is invalid or has expired.';
		}
	});
</script>

<svelte:head>
	<title>Verify email · Foliyo</title>
</svelte:head>

<div class="auth-page">
	<Card>
		{#if status === 'working'}
			<h1>Verifying…</h1>
			<p class="muted">Confirming your email address.</p>
		{:else if status === 'ok'}
			<h1>Email verified</h1>
			<p class="muted">Redirecting…</p>
		{:else}
			<h1>Could not verify</h1>
			<p class="error">{error}</p>
			<p class="footer muted">
				<a href="/check-email">Resend verification</a>
				· <a href="/login">Sign in</a>
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
	.error {
		color: var(--color-error, #dc2626);
	}
	.footer {
		margin-top: 1.25rem;
		text-align: center;
		font-size: 0.875rem;
	}
</style>
