<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { clearPendingSignupEmail, verifyEmail } from '$lib/api/cloud';
	import { accessToken } from '$lib/stores/token';
	import { postAuthPath, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	let token = $state('');
	let password = $state('');
	let confirm = $state('');
	let loading = $state(false);
	let missing = $state(false);

	onMount(() => {
		token =
			new URL(window.location.href).searchParams.get('token') ??
			$page.url.searchParams.get('token') ??
			'';
		missing = !token;
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (password.length < 8) {
			showToast('Password must be at least 8 characters', 'error');
			return;
		}
		if (password.length > 72) {
			showToast('Password must be at most 72 characters', 'error');
			return;
		}
		if (password !== confirm) {
			showToast('Passwords do not match', 'error');
			return;
		}
		loading = true;
		try {
			const data = await verifyEmail(token, password);
			clearPendingSignupEmail();
			accessToken.set(data.token);
			user.set(data.user);
			showToast('Account ready', 'success');
			goto(postAuthPath(data.user));
		} catch {
			showToast('This link is invalid or has expired.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Choose a password · Foliyo</title>
</svelte:head>

<div class="auth-page">
	<Card>
		{#if missing}
			<h1>Could not verify</h1>
			<p class="muted">This link is missing a token. Request a new one from sign up.</p>
			<p class="footer muted">
				<a href="/check-email">Resend</a>
				· <a href="/login">Sign in</a>
			</p>
		{:else}
			<h1>Choose a password</h1>
			<p class="muted">Finish creating your account. Use at least 8 characters.</p>
			<form onsubmit={handleSubmit}>
				<Input
					label="Password"
					type="password"
					name="password"
					autocomplete="new-password"
					bind:value={password}
				/>
				<Input
					label="Confirm password"
					type="password"
					name="confirm"
					autocomplete="new-password"
					bind:value={confirm}
				/>
				<Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Create account'}</Button>
			</form>
			<p class="footer muted"><a href="/login">Sign in</a></p>
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
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}
	.footer {
		margin-top: 1.25rem;
		text-align: center;
		font-size: 0.875rem;
	}
</style>
