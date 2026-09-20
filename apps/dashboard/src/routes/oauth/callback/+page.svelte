<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Card from '$lib/components/ui/Card.svelte';
	import { accessToken } from '$lib/stores/token';
	import { loadSession, postAuthPath, user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	onMount(async () => {
		const fromUrl = new URL(window.location.href).searchParams.get('access_token');
		const token = fromUrl ?? get(accessToken);

		if (!token) {
			showToast('Could not sign in with that provider.', 'error');
			goto('/login');
			return;
		}

		accessToken.set(token);

		const ok = await loadSession();
		if (!ok) {
			showToast('Could not sign in with that provider.', 'error');
			goto('/login');
			return;
		}

		const u = get(user);
		if (!u) {
			showToast('Could not sign in with that provider.', 'error');
			goto('/login');
			return;
		}

		goto(postAuthPath(u));
	});
</script>

<svelte:head>
	<title>Signing in · Foliyo</title>
</svelte:head>

<div class="auth-page">
	<Card>
		<p class="status">Signing you in…</p>
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
	.status {
		margin: 0;
		text-align: center;
		color: var(--color-muted);
		font-size: 0.9375rem;
	}
</style>
