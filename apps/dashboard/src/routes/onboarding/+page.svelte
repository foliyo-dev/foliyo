<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';
	import { checkHandle, claimHandle } from '$lib/api/cloud';
	import { showToast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let handle = '';
	let checking = false;
	let available: boolean | null = null;
	let saving = false;
	let checkTimer: ReturnType<typeof setTimeout>;

	onMount(() => {
		if ($user?.handle) handle = $user.handle;
	});

	onDestroy(() => clearTimeout(checkTimer));

	function scheduleCheck() {
		clearTimeout(checkTimer);
		checkTimer = setTimeout(onHandleInput, 300);
	}

	async function onHandleInput() {
		const h = handle.toLowerCase().trim();
		if (h.length < 3) {
			available = null;
			return;
		}
		checking = true;
		try {
			const res = await checkHandle(h);
			available = res.available;
		} catch {
			available = null;
		} finally {
			checking = false;
		}
	}

	async function finish() {
		const h = handle.toLowerCase().trim();
		if (!h || available === false) {
			showToast('Choose an available handle', 'error');
			return;
		}
		saving = true;
		try {
			const res = await claimHandle(h);
			user.update((u) => (u ? { ...u, handle: res.handle, onboarding_complete: 1 } : u));
			goto('/');
		} catch {
			showToast('Could not save handle', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="auth-page">
	<Card>
		<h1>Choose your public URL</h1>
		<p class="muted">Your portfolio will be at <strong>foliyo.dev/u/{handle || 'you'}</strong></p>

		<div class="handle-field">
			<span class="prefix">foliyo.dev/u/</span>
			<Input label="" bind:value={handle} on:input={scheduleCheck} placeholder="yourname" />
		</div>

		{#if checking}
			<p class="muted status">Checking…</p>
		{:else if available === true}
			<p class="ok status">Available</p>
		{:else if available === false}
			<p class="taken status">Already taken</p>
		{/if}

		<Button disabled={saving || available === false} on:click={finish}>
			{saving ? 'Saving…' : 'Continue to dashboard'}
		</Button>
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
	}
	.muted {
		color: var(--color-muted);
		margin: 0 0 1.25rem;
	}
	.handle-field {
		margin-bottom: 1rem;
	}
	.prefix {
		display: block;
		font-size: 0.875rem;
		color: var(--color-muted);
		margin-bottom: 0.35rem;
	}
	.status {
		font-size: 0.875rem;
		margin: 0 0 1rem;
	}
	.ok {
		color: var(--color-success);
	}
	.taken {
		color: var(--color-error);
	}
</style>
