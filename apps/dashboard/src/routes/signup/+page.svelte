<script lang="ts">
	import { goto } from '$app/navigation';
	import { user, postAuthPath } from '$lib/stores/auth';
	import { accessToken } from '$lib/stores/token';
	import { signup as signupApi } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';
	import { privacyUrl, publicHost } from '$lib/config';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let email = '';
	let password = '';
	let confirm = '';
	let consent = false;
	let loading = false;

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (password !== confirm) {
			showToast('Passwords do not match', 'error');
			return;
		}
		if (!consent) {
			showToast('You must accept the privacy policy', 'error');
			return;
		}
		loading = true;
		try {
			const data = await signupApi(email, password, consent);
			accessToken.set(data.token);
			user.set(data.user);
			goto(postAuthPath(data.user));
		} catch (err) {
			const raw = err instanceof Error ? err.message : '';
			let msg = 'Could not create account.';
			try {
				const body = JSON.parse(raw) as { error?: string; message?: string };
				if (body.error === 'email already registered') {
					msg = 'That email is already registered. Try signing in.';
				} else if (body.error === 'signup_unavailable' || body.message?.includes('foliyo-cloud')) {
					msg =
						'Signup needs the cloud API on :8080. Stop OSS core, then run: pnpm --filter @foliyo/cloud-api dev';
				} else if (body.message) {
					msg = body.message;
				} else if (raw.includes('unauthorized') || raw.includes('401')) {
					msg =
						'Signup needs the cloud API on :8080 (OSS core is running instead). Stop foliyo core and start foliyo-cloud API.';
				}
			} catch {
				if (raw.includes('unauthorized') || raw.includes('501') || raw.includes('signup_unavailable')) {
					msg =
						'Signup needs the cloud API on :8080. Stop OSS core, then start foliyo-cloud API.';
				}
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
		<form on:submit={handleSubmit}>
			<Input label="Email" type="email" name="email" autocomplete="email" bind:value={email} />
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
			<p class="hint">At least 8 characters.</p>
			<label class="consent">
				<input type="checkbox" bind:checked={consent} />
				I agree to the <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a>
				(DPDP Act 2023)
			</label>
			<Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</Button>
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
