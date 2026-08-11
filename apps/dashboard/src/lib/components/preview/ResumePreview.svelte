<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fetchResumePreviewHtml } from '$lib/api/preview';

	/** Owner resume id — null shows an empty pane prompt. */
	export let resumeId: string | null = null;
	export let resumeName = 'Resume';

	let loading = false;
	let error = '';
	let drawerOpen = false;
	let blobUrl = '';
	let loadedFor = '';

	$: if (resumeId !== loadedFor) {
		if (resumeId) void refresh();
		else clearPreview();
	}

	onDestroy(() => {
		if (blobUrl) URL.revokeObjectURL(blobUrl);
	});

	function clearPreview() {
		loading = false;
		error = '';
		loadedFor = '';
		if (blobUrl) {
			URL.revokeObjectURL(blobUrl);
			blobUrl = '';
		}
	}

	export async function refresh(): Promise<void> {
		if (!resumeId) {
			clearPreview();
			return;
		}
		const id = resumeId;
		loading = true;
		error = '';
		try {
			const html = await fetchResumePreviewHtml(id);
			if (blobUrl) URL.revokeObjectURL(blobUrl);
			blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
			loadedFor = id;
		} catch {
			error = 'Could not load private preview';
			loadedFor = id;
			if (blobUrl) {
				URL.revokeObjectURL(blobUrl);
				blobUrl = '';
			}
		} finally {
			loading = false;
		}
	}

	function openInNewTab() {
		if (!blobUrl) return;
		window.open(blobUrl, '_blank', 'noopener,noreferrer');
	}

	function openDrawer() {
		drawerOpen = true;
		if (resumeId && !blobUrl && !loading) void refresh();
	}

	function closeDrawer() {
		drawerOpen = false;
	}
</script>

<!-- Desktop sticky pane (same pattern as LibraryPreview) -->
<aside class="pane desktop" aria-label="Private resume preview">
	<div class="toolbar">
		<span class="title">Private preview</span>
		<div class="actions">
			<button type="button" class="ghost" disabled={loading || !resumeId} on:click={() => refresh()}>
				{loading ? '…' : 'Refresh'}
			</button>
			<button type="button" class="ghost" disabled={!blobUrl} on:click={openInNewTab}>
				Open
			</button>
		</div>
	</div>
	<p class="hint">
		{#if resumeId}
			Signed-in preview of {resumeName}. Stays private until you publish a share link.
		{:else}
			Select <strong>Preview</strong> on a resume to see it here.
		{/if}
	</p>
	<div class="frame-wrap">
		{#if !resumeId}
			<p class="muted">No resume selected.</p>
		{:else if error}
			<p class="err">{error}</p>
		{:else if blobUrl}
			<iframe title="Private preview of {resumeName}" src={blobUrl} class="frame"></iframe>
		{:else if loading}
			<p class="muted">Loading preview…</p>
		{/if}
	</div>
</aside>

<!-- Mobile trigger + drawer -->
<button type="button" class="fab mobile" on:click={openDrawer}>Preview</button>

{#if drawerOpen}
	<div class="overlay mobile" role="presentation" on:click={closeDrawer} on:keydown={() => {}}></div>
	<aside class="drawer mobile" aria-label="Private resume preview">
		<div class="toolbar">
			<span class="title">Private preview</span>
			<div class="actions">
				<button type="button" class="ghost" disabled={loading || !resumeId} on:click={() => refresh()}>
					{loading ? '…' : 'Refresh'}
				</button>
				<button type="button" class="ghost" disabled={!blobUrl} on:click={openInNewTab}>
					Open
				</button>
				<button type="button" class="ghost" on:click={closeDrawer}>Close</button>
			</div>
		</div>
		<p class="hint">
			{#if resumeId}
				Signed-in preview of {resumeName}.
			{:else}
				Select Preview on a resume first.
			{/if}
		</p>
		<div class="frame-wrap drawer-frame">
			{#if !resumeId}
				<p class="muted">No resume selected.</p>
			{:else if error}
				<p class="err">{error}</p>
			{:else if blobUrl}
				<iframe title="Private preview of {resumeName}" src={blobUrl} class="frame"></iframe>
			{:else if loading}
				<p class="muted">Loading preview…</p>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.pane {
		position: sticky;
		top: 0;
		align-self: start;
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100cqh;
		max-height: 100cqh;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.title {
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.ghost {
		border: 1px solid var(--color-border);
		background: transparent;
		border-radius: var(--radius);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}
	.ghost:hover:not(:disabled) {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.ghost:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.frame-wrap {
		flex: 1 1 0;
		min-height: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		overflow: auto;
		background: #e8eaed;
		box-shadow: 0 4px 24px rgba(83, 74, 183, 0.08);
		display: flex;
		justify-content: center;
		align-items: stretch;
		padding: 0.75rem;
	}
	.frame {
		display: block;
		width: 100%;
		max-width: 8.5in;
		height: 100%;
		min-height: 480px;
		border: 0;
		border-radius: 4px;
		background: #fff;
		box-shadow: 0 2px 12px rgba(17, 24, 39, 0.08);
	}
	.muted,
	.err {
		padding: 1.25rem;
		font-size: 0.875rem;
		margin: 0;
	}
	.err {
		color: var(--color-error);
	}
	.fab {
		display: none;
	}
	.overlay,
	.drawer {
		display: none;
	}

	@media (max-width: 1099px) {
		.desktop {
			display: none;
		}
		.fab {
			display: inline-flex;
			position: fixed;
			right: 1rem;
			bottom: 1rem;
			z-index: 40;
			padding: 0.7rem 1.1rem;
			border: none;
			border-radius: 999px;
			background: var(--color-primary);
			color: #fff;
			font-weight: 600;
			font-size: 0.875rem;
			box-shadow: 0 8px 24px rgba(83, 74, 183, 0.35);
			cursor: pointer;
		}
		.overlay {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(26, 26, 46, 0.45);
			z-index: 50;
		}
		.drawer {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(100vw, 420px);
			z-index: 60;
			padding: 1rem;
			background: var(--color-bg);
			border-left: 1px solid var(--color-border);
			box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
		}
		.drawer-frame {
			flex: 1;
			min-height: 0;
		}
		.drawer .frame {
			height: 100%;
			min-height: 320px;
		}
	}
</style>
