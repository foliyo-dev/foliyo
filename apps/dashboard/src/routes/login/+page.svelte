<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, postAuthPath } from '$lib/stores/auth';
	import { isSaas, siteUrl } from '$lib/config';
	import { showToast } from '$lib/stores/toast';
	import { Logo } from '@foliyo/ui';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let email = '';
	let password = '';
	let loading = false;

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		try {
			const u = await login(email, password);
			goto(postAuthPath(u));
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			if (msg === 'pending_deletion') {
				showToast('Account scheduled for deletion — cancel it first.', 'error');
				goto('/cancel-delete');
			} else if (msg === 'email_not_verified') {
				showToast('Confirm your email from the link we sent, then choose a password.', 'error');
				goto('/check-email');
			} else {
				showToast('Invalid email or password', 'error');
			}
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Log in · Foliyo</title>
</svelte:head>

<div class="login-page">
	<Card>
		<Logo
			variant="tagline"
			alt="Foliyo — your folio. your way."
			class="login-logo"
			width="220"
			height="53"
		/>
		<p class="muted intro">Sign in to manage your portfolio</p>
		<form on:submit={handleSubmit}>
			<Input label="Email" type="email" name="email" autocomplete="email" bind:value={email} />
			<Input
				label="Password"
				type="password"
				name="password"
				autocomplete="current-password"
				bind:value={password}
			/>
			<Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
		</form>
		<p class="forgot"><a href="/forgot">Forgot password?</a></p>
		{#if isSaas}
			<p class="footer muted">
				New here? <a href="/signup">Create an account</a>
			</p>
			<p class="footer quiet muted">
				<a href="/cancel-delete">Cancel account deletion</a>
			</p>
		{:else}
			<p class="footer muted">Self-host · {siteUrl}</p>
		{/if}
	</Card>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: linear-gradient(160deg, var(--color-primary-light) 0%, var(--color-bg) 45%);
	}
	.login-page :global(.login-logo) {
		display: block;
		margin: 0 auto 1.5rem;
		max-width: 100%;
		height: auto;
	}
	.intro {
		text-align: center;
		margin: -0.5rem 0 1rem;
		font-size: 0.875rem;
	}
	.muted {
		color: var(--color-muted);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.footer {
		margin-top: 1.25rem;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.forgot {
		margin: 0.75rem 0 0;
		text-align: center;
		font-size: 0.875rem;
	}
	.quiet {
		margin-top: 0.5rem;
		font-size: 0.8125rem;
	}
</style>
