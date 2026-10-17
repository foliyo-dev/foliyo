<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';
	import { showToast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';

	let password = '';
	let confirm = '';
	let loading = false;
	let token = '';
	let missing = false;

	onMount(() => {
		token =
			new URL(window.location.href).searchParams.get('token') ??
			$page.url.searchParams.get('token') ??
			'';
		missing = !token;
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (password.length < 8) {
			showToast('Password must be at least 8 characters', 'error');
			return;
		}
		if (password !== confirm) {
			showToast('Passwords do not match', 'error');
			return;
		}
		loading = true;
		try {
			await api('/auth/reset', {
				method: 'POST',
				body: JSON.stringify({ token, password })
			});
			showToast('Password updated — sign in', 'success');
			goto('/login');
		} catch {
			showToast('This reset link is invalid or has expired', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset password · Foliyo</title>
</svelte:head>

{#if missing}
	<AuthShell
		title="Choose a new password"
		description="This reset link is missing a token. Request a new one from the login page."
	>
		<p class="footer"><a href="/forgot">Forgot password</a> · <a href="/login">Sign in</a></p>
	</AuthShell>
{:else}
	<AuthShell title="Choose a new password" description="Use at least 8 characters.">
		<form on:submit={handleSubmit}>
			<Input
				label="New password"
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
			<Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Update password'}</Button>
		</form>
		<p class="footer"><a href="/login">Back to sign in</a></p>
	</AuthShell>
{/if}
