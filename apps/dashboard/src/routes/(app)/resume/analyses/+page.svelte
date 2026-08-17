<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import RecentAnalyses from '@foliyo/ui/RecentAnalyses.svelte';
	import { listJobAnalyses, type JobAnalysisSummary } from '$lib/api/jobs';
	import { showToast } from '$lib/stores/toast';

	let items: JobAnalysisSummary[] = [];
	let loading = true;

	onMount(load);

	async function load() {
		loading = true;
		try {
			const { items: recents } = await listJobAnalyses();
			items = recents;
		} catch {
			items = [];
			showToast('Failed to load analyses', 'error');
		} finally {
			loading = false;
		}
	}

	function openAnalysis(id: string) {
		void goto(`/resume/tailor?analysis=${encodeURIComponent(id)}`);
	}
</script>

<PageHeader
	title="JD history"
	description="Saved fit analyses. Opening one does not use your daily AI units."
/>

{#if loading}
	<p class="muted">Loading…</p>
{:else}
	<Card>
		{#if items.length}
			<RecentAnalyses items={items} showIntro={false} onSelect={openAnalysis} />
		{:else}
			<p class="muted">
				No saved analyses yet. <a href="/resume/tailor">Paste a JD</a> to run your first fit check.
			</p>
		{/if}
	</Card>
{/if}

<style>
	.muted {
		color: var(--color-muted);
	}
	.muted :global(a) {
		color: var(--color-primary);
	}
</style>
