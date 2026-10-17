<script lang="ts">
	import { goto } from '$app/navigation';
	import { signup as signupApi } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';
	import { privacyUrl, publicHost } from '$lib/config';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import OAuthButtons from '$lib/components/auth/OAuthButtons.svelte';

	let email = $state('');
	let consent = $state(false);
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!consent) {
			showToast('You must accept the privacy policy', 'error');
			return;
		}
		loading = true;
		try {
			await signupApi(email, consent);
			goto('/check-email');
		} catch (err) {
			const raw = err instanceof Error ? err.message : '';
			let msg = 'Could not send the verification email.';
			if (raw.includes('rate_limited')) {
				msg = 'Too many attempts. Try again later.';
			} else if (raw.includes('signup_unavailable') || raw.includes('foliyo-cloud')) {
				msg =
					'Signup needs the cloud API on :8080. Stop OSS core, then run: pnpm --filter @foliyo/cloud-api dev';
			} else if (raw.includes('unauthorized') || raw.includes('401') || raw.includes('501')) {
				msg =
					'Signup needs the cloud API on :8080 (OSS core is running instead). Stop foliyo core and start foliyo-cloud API.';
			}
			showToast(msg, 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign up · Foliyo</title>
</svelte:head>

<AuthShell title="Create your account" description={`Start building your portfolio at ${publicHost()}`}>
	<label class="consent">
		<input type="checkbox" bind:checked={consent} />
		I agree to the <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a>
		(DPDP Act 2023)
	</label>
	<form onsubmit={handleSubmit}>
		<Input label="Email" type="email" name="email" autocomplete="email" bind:value={email} />
		<p class="hint">We’ll email a link to choose your password. It expires in 60 minutes.</p>
		<Button type="submit" disabled={loading || !consent}>{loading ? 'Sending…' : 'Continue'}</Button>
	</form>
	<OAuthButtons consent={consent} disabled={!consent} />
	<p class="footer">Already have an account? <a href="/login">Sign in</a></p>
</AuthShell>

<style>
	.consent {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		margin-bottom: var(--space-3);
		font-size: 0.8125rem;
		line-height: 1.4;
	}
	.hint {
		margin: calc(var(--space-1) * -1) 0 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
</style>
