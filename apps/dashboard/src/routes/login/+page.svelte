<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { login, postAuthPath } from '$lib/stores/auth';
	import { isSaas, siteUrl } from '$lib/config';
	import { showToast } from '$lib/stores/toast';
	import { Logo } from '@foliyo/ui';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import OAuthButtons from '$lib/components/auth/OAuthButtons.svelte';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);

	const oauthErrorMessages: Record<string, string> = {
		email_unverified: 'Verify your email with Google or GitHub, then try again.',
		consent_required: 'Create an account first to accept the privacy policy.',
		pending_deletion: 'Account scheduled for deletion — cancel it first.',
		rate_limited: 'Too many attempts. Try again later.',
		invalid_state: 'Sign-in failed. Please try again.',
		exchange_failed: 'Sign-in failed. Please try again.',
		missing_code: 'Sign-in failed. Please try again.'
	};

	onMount(() => {
		const url = new URL(window.location.href);
		const oauthError = url.searchParams.get('oauth_error');
		if (!oauthError) return;

		const msg =
			oauthErrorMessages[oauthError] ?? 'Could not sign in with that provider.';
		showToast(msg, 'error');

		if (oauthError === 'pending_deletion') {
			goto('/cancel-delete');
		}

		url.searchParams.delete('oauth_error');
		const clean = url.pathname + url.search + url.hash;
		window.history.replaceState({}, '', clean);
	});

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

<AuthShell showLogo description="Sign in to manage your portfolio">
	{#snippet logo()}
		<Logo
			variant="tagline"
			alt="Foliyo — your folio. your way."
			class="login-logo"
			width="200"
			height="48"
		/>
	{/snippet}
	<form onsubmit={handleSubmit}>
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
	<OAuthButtons />
	{#if isSaas}
		<p class="footer">
			New here? <a href="/signup">Create an account</a>
		</p>
		<p class="footer quiet">
			<a href="/cancel-delete">Cancel account deletion</a>
		</p>
	{:else}
		<p class="footer">Self-host · {siteUrl}</p>
	{/if}
</AuthShell>

<style>
	.forgot {
		margin: var(--space-3) 0 0;
		text-align: center;
		font-size: 0.8125rem;
	}
	.quiet {
		margin-top: var(--space-2) !important;
		font-size: 0.75rem;
	}
</style>
