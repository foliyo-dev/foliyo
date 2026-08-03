<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { cancelAccountDeletion } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';

	let email = '';
	let password = '';
	let loading = false;

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		try {
			const data = await cancelAccountDeletion(email, password);
			showToast(data.message ?? 'Deletion cancelled', 'success');
			goto('/login');
		} catch {
			showToast('Could not cancel deletion — check email and password', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-page">
	<Card>
		<h1>Cancel account deletion</h1>
		<p class="muted">Enter your email and password to keep your Foliyo account.</p>
		<form on:submit={handleSubmit}>
			<Input label="Email" type="email" bind:value={email} />
			<Input label="Password" type="password" bind:value={password} />
			<Button type="submit" disabled={loading}>
				{loading ? 'Cancelling…' : 'Cancel deletion'}
			</Button>
		</form>
		<p class="footer muted"><a href="/login">Back to sign in</a></p>
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
