<script lang="ts">
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';
	import { accessToken } from '$lib/stores/token';
	import { signup as signupApi } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';
	import { siteUrl } from '$lib/config';
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
			goto('/onboarding');
		} catch {
			showToast('Could not create account. Email may already be registered.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-page">
	<Card>
		<h1>Create your account</h1>
		<p class="muted">Start building your portfolio on foliyo.dev</p>
		<form on:submit={handleSubmit}>
			<Input label="Email" type="email" bind:value={email} />
			<Input label="Password" type="password" bind:value={password} />
			<Input
				label="Confirm password"
				type="password"
				bind:value={confirm}
			/>
			<label class="consent">
				<input type="checkbox" bind:checked={consent} />
				I agree to the <a href="{siteUrl}/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
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
		margin: 0 0 1.25rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.consent {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		font-size: 0.875rem;
	}
	.footer {
		margin-top: 1.25rem;
		text-align: center;
	}
</style>
