<script lang="ts">
	import { goto } from '$app/navigation';
	import { signup as signupApi } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';
	import { privacyUrl, publicHost } from '$lib/config';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

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

<div class="auth-page">
	<Card>
		<h1>Create your account</h1>
		<p class="muted">Start building your portfolio at {publicHost()}</p>
		<form onsubmit={handleSubmit}>
			<Input label="Email" type="email" name="email" autocomplete="email" bind:value={email} />
			<p class="hint">We’ll email a link to choose your password. It expires in 60 minutes.</p>
			<label class="consent">
				<input type="checkbox" bind:checked={consent} />
				I agree to the <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a>
				(DPDP Act 2023)
			</label>
			<Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Continue'}</Button>
		</form>
		<p class="footer muted">Already have an account? <a href="/login">Sign in</a></p>
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
	.consent {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		font-size: 0.875rem;
	}
	.hint {
		margin: -0.35rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.footer {
		margin-top: 1.25rem;
		text-align: center;
		font-size: 0.875rem;
	}
</style>
