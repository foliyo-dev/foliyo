<script lang="ts">
	import { api } from '$lib/api/client';
	import { showToast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';

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

{#if sent}
	<AuthShell
		title="Forgot password"
		description="If that email is registered, we sent a reset link. Check your inbox and spam folder."
	>
		<p class="footer"><a href="/login">Back to sign in</a></p>
	</AuthShell>
{:else}
	<AuthShell title="Forgot password" description="We’ll email a link to choose a new password.">
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
		<p class="footer"><a href="/login">Back to sign in</a></p>
	</AuthShell>
{/if}
