<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import Toast from '$lib/components/ui/Toast.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { hydratePublicConfig } from '$lib/config';

	let { children } = $props();
	let ready = $state(false);

	onMount(async () => {
		await Promise.race([
			hydratePublicConfig(),
			new Promise<void>((r) => setTimeout(r, 2500))
		]);
		ready = true;
	});
</script>

<svelte:head>
	<title>Foliyo</title>
</svelte:head>

<Toast />
<ConfirmDialog />
{#if ready}
	{@render children()}
{/if}
