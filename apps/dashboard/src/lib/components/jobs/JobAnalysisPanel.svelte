<script lang="ts">
	import type { JobAnalysis } from '$lib/api/jobs';
	import JobAnalysisPanel from '@foliyo/ui/JobAnalysisPanel.svelte';
	import { APP_BASE } from '$lib/config';

	export let analysis: JobAnalysis;
	export let accepted: Set<string>;
	export let compact = false;
</script>

<JobAnalysisPanel
	{analysis}
	bind:accepted
	{compact}
	skillsBaseUrl={APP_BASE}
/>
