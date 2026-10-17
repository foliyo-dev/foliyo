<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
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

<AuthShell description="Signing you in…" />
