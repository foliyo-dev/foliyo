<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/stores/auth';
	import { isSaas } from '$lib/config';
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
			await login(email, password);
			goto('/');
		} catch {
			showToast('Invalid email or password', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<div class="login-page">
	<Card>
		<Logo
			variant="tagline"
			alt="Foliyo — your folio. your way."
			class="login-logo"
			width="220"
			height="53"
		/>
		<form on:submit={handleSubmit}>
			<Input label="Email" type="email" name="email" bind:value={email} />
			<Input label="Password" type="password" name="password" bind:value={password} />
			<Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
		</form>
		{#if isSaas}
			<p class="footer muted">New here? <a href="/signup">Create an account</a></p>
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
</style>
