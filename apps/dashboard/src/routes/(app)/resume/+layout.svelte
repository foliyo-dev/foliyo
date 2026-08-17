<script lang="ts">
	import ResumeSubnav from '$lib/components/resume/ResumeSubnav.svelte';

	let { children } = $props();
</script>

<ResumeSubnav />
{@render children()}
