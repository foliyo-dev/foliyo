<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';
	import { showToast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let password = '';
	let confirm = '';
	let loading = false;
	let token = '';
	let missing = false;

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
		if (password !== confirm) {
			showToast('Passwords do not match', 'error');
			return;
		}
		loading = true;
		try {
			await api('/auth/reset', {
				method: 'POST',
				body: JSON.stringify({ token, password })
			});
			showToast('Password updated — sign in', 'success');
			goto('/login');
		} catch {
			showToast('This reset link is invalid or has expired', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset password · Foliyo</title>
</svelte:head>

<div class="auth-page">
	<Card>
		<h1>Choose a new password</h1>
		{#if missing}
			<p class="muted">This reset link is missing a token. Request a new one from the login page.</p>
			<p class="footer muted"><a href="/forgot">Forgot password</a> · <a href="/login">Sign in</a></p>
		{:else}
			<p class="muted">Use at least 8 characters.</p>
			<form on:submit={handleSubmit}>
				<Input
					label="New password"
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
				<Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Update password'}</Button>
			</form>
			<p class="footer muted"><a href="/login">Back to sign in</a></p>
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
		margin: 0 0 0.35rem;
		font-size: 1.5rem;
		text-align: center;
	}
	.muted {
		color: var(--color-muted);
		text-align: center;
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
