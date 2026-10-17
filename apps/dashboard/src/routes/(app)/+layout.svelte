<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import PlanExpiryBanner from '$lib/components/PlanExpiryBanner.svelte';

	const STORAGE_COLLAPSE = 'foliyo.nav.collapsed';

	let navOpen = false;
	let collapsed = false;

	onMount(() => {
		try {
			collapsed = localStorage.getItem(STORAGE_COLLAPSE) === '1';
		} catch {
			/* ignore */
		}
	});

	function toggleCollapse() {
		collapsed = !collapsed;
		try {
			localStorage.setItem(STORAGE_COLLAPSE, collapsed ? '1' : '0');
		} catch {
			/* ignore */
		}
	}
</script>

<div class="app-shell" class:nav-open={navOpen} class:sidebar-collapsed={collapsed}>
	<Sidebar
		open={navOpen}
		{collapsed}
		onclose={() => (navOpen = false)}
		ontogglecollapse={toggleCollapse}
	/>
	<div class="main">
		<Header on:menu={() => (navOpen = true)} />
		<div class="content">
			<PlanExpiryBanner />
			<div class="content-inner">
				<slot />
			</div>
		</div>
	</div>
</div>

<style>
	.app-shell {
		display: flex;
		height: 100dvh;
		overflow: hidden;
	}
	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.content {
		padding: var(--space-3) var(--space-4);
		flex: 1;
		min-height: 0;
		overflow: auto;
		overflow-x: clip;
		container-type: size;
		container-name: app-content;
	}
	.content-inner {
		max-width: var(--content-max);
		margin: 0 auto;
		min-height: 100%;
	}
	/* :global — child component class hashes differ under Svelte scoping */
	.content-inner:has(:global(.editor-with-preview)),
	.content-inner:has(:global(.blog-list-page)) {
		max-width: none;
		height: 100%;
	}
	.content:has(:global(.editor-with-preview)),
	.content:has(:global(.blog-list-page)) {
		padding: var(--space-2) var(--space-3);
	}

	@media (max-width: 900px) {
		.content {
			padding: var(--space-3) var(--space-3) var(--space-4);
		}
		.content:has(:global(.editor-with-preview)),
		.content:has(:global(.blog-list-page)) {
			padding: var(--space-2) var(--space-3) var(--space-3);
		}
	}
</style>
