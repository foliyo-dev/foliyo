<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
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

<svelte:head>
	<title>Cancel deletion · Foliyo</title>
</svelte:head>

<AuthShell
	title="Cancel account deletion"
	description="Enter your email and password to keep your Foliyo account."
>
	<form on:submit={handleSubmit}>
		<Input label="Email" type="email" bind:value={email} />
		<Input label="Password" type="password" bind:value={password} />
		<Button type="submit" disabled={loading}>
			{loading ? 'Cancelling…' : 'Cancel deletion'}
		</Button>
	</form>
	<p class="footer"><a href="/login">Back to sign in</a></p>
</AuthShell>
