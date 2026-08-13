<script lang="ts">
	import '../app.css';
	import Toast from '$lib/components/ui/Toast.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Foliyo</title>
</svelte:head>

<Toast />
<ConfirmDialog />
{@render children()}
