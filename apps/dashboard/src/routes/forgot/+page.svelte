<script lang="ts">
	import { api } from '$lib/api/client';
	import { showToast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let email = '';
	let loading = false;
	let sent = false;

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		try {
			await api('/auth/forgot', {
				method: 'POST',
				body: JSON.stringify({ email })
			});
			sent = true;
		} catch {
			showToast('Could not send reset email. Try again.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot password · Foliyo</title>
</svelte:head>

<div class="auth-page">
	<Card>
		<h1>Forgot password</h1>
		{#if sent}
			<p class="muted">
				If that email is registered, we sent a reset link. Check your inbox and spam folder.
			</p>
			<p class="footer muted"><a href="/login">Back to sign in</a></p>
		{:else}
			<p class="muted">We’ll email a link to choose a new password.</p>
			<form on:submit={handleSubmit}>
				<Input
					label="Email"
					type="email"
					name="email"
					autocomplete="email"
					bind:value={email}
				/>
				<Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
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
