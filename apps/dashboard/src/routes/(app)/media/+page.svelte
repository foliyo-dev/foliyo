<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		listUploadedMedia,
		deleteUploadedMedia,
		uploadProjectImage,
		type MediaAsset
	} from '$lib/api/projects';
	import { ApiError } from '$lib/api/client';
	import { mediaUrl } from '$lib/config';
	import { showToast } from '$lib/stores/toast';
	import { requestConfirm } from '$lib/stores/confirm';

	let items = $state.raw<MediaAsset[]>([]);
	let loading = $state(true);
	let uploading = $state(false);
	let deletingId = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const attachFileInput = (node: HTMLInputElement) => {
		fileInput = node;
		return () => {
			if (fileInput === node) fileInput = null;
		};
	};

	const count = $derived(items.length);

	function shortName(item: MediaAsset): string {
		const path = (item.url || '').split('?')[0];
		const base = path.split('/').filter(Boolean).pop();
		if (base) return base.length > 28 ? `${base.slice(0, 25)}…` : base;
		return item.id.length > 12 ? `${item.id.slice(0, 10)}…` : item.id;
	}

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function uploadErrorMessage(err: unknown): string {
		if (err instanceof ApiError) {
			try {
				const parsed = JSON.parse(err.message) as { message?: string; error?: string };
				if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
				if (typeof parsed.error === 'string' && parsed.error.trim()) {
					if (parsed.error === 'upload not implemented yet') {
						return 'Image upload is not available on this API yet.';
					}
					return parsed.error;
				}
			} catch {
				if (err.message && !err.message.startsWith('<')) return err.message.slice(0, 160);
			}
		}
		return 'Image upload failed — try JPEG, PNG, or WebP under 3 MB';
	}

	async function load() {
		loading = true;
		try {
			const res = await listUploadedMedia();
			items = res.items ?? [];
		} catch (err) {
			items = [];
			const msg =
				err instanceof ApiError
					? err.message.slice(0, 160) || 'Could not load media'
					: 'Could not load media';
			showToast(msg, 'error');
		} finally {
			loading = false;
		}
	}

	async function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		uploading = true;
		try {
			await uploadProjectImage(file);
			showToast('Image uploaded', 'success');
			await load();
		} catch (err) {
			showToast(uploadErrorMessage(err), 'error');
		} finally {
			uploading = false;
		}
	}

	async function copyUrl(item: MediaAsset) {
		const url = mediaUrl(item.url) || item.url;
		try {
			await navigator.clipboard.writeText(url);
			showToast('URL copied', 'success');
		} catch {
			showToast('Could not copy URL', 'error');
		}
	}

	async function removeItem(item: MediaAsset) {
		const ok = await requestConfirm({
			title: 'Delete image permanently?',
			message:
				'This permanently deletes the file and clears it from projects, portfolio covers, and theme photos that use it. This cannot be undone.',
			confirmLabel: 'Delete forever'
		});
		if (!ok) return;
		deletingId = item.id;
		try {
			await deleteUploadedMedia(item.id);
			items = items.filter((i) => i.id !== item.id);
			showToast('Image deleted', 'success');
		} catch (err) {
			const msg =
				err instanceof ApiError
					? err.message.slice(0, 160) || 'Failed to delete image'
					: 'Failed to delete image';
			showToast(msg, 'error');
		} finally {
			deletingId = null;
		}
	}

	onMount(() => {
		void load();
	});
</script>

<div class="library-page">
	<input
		{@attach attachFileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		hidden
		disabled={uploading}
		onchange={onFileChange}
	/>
	<PageHeader
		title="Media"
		description="Upload, browse, and remove images used across projects and portfolios."
	>
		{#snippet actions()}
			{#if !loading}
				<span class="count">{count} {count === 1 ? 'image' : 'images'}</span>
			{/if}
			<Button size="sm" disabled={uploading} on:click={() => fileInput?.click()}>
				{uploading ? 'Uploading…' : 'Upload'}
			</Button>
		{/snippet}
	</PageHeader>

{#if loading}
	<p class="muted">Loading media…</p>
{:else if items.length === 0}
	<div class="empty">
		<p class="empty-title">No images yet</p>
		<p class="muted">Upload JPEG, PNG, or WebP files to reuse across projects and portfolios.</p>
		<Button disabled={uploading} on:click={() => fileInput?.click()}>
			{uploading ? 'Uploading…' : 'Upload an image'}
		</Button>
	</div>
{:else}
	<div class="grid">
		{#each items as item (item.id)}
			<article class="card">
				<div class="thumb">
					<img src={mediaUrl(item.url)} alt="" loading="lazy" />
				</div>
				<div class="meta">
					<p class="name" title={item.url}>{shortName(item)}</p>
					{#if item.created_at}
						<p class="date">{formatDate(item.created_at)}</p>
					{/if}
				</div>
				<div class="actions">
					<Button size="sm" variant="ghost" on:click={() => void copyUrl(item)}>Copy URL</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={deletingId === item.id}
						on:click={() => void removeItem(item)}
					>
						{deletingId === item.id ? 'Deleting…' : 'Delete'}
					</Button>
				</div>
			</article>
		{/each}
	</div>
{/if}
</div>

<style>
	.library-page {
		min-height: 100%;
	}
	.count {
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.muted {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.875rem;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-6) var(--space-4);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.empty-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
		gap: var(--space-4);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		min-width: 0;
	}
	.thumb {
		aspect-ratio: 1;
		border-radius: calc(var(--radius) - 2px);
		overflow: hidden;
		background: var(--color-bg);
	}
	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.meta {
		min-width: 0;
		padding: 0 var(--space-1);
	}
	.name {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.date {
		margin: 0.15rem 0 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: 0 var(--space-1) var(--space-1);
	}
</style>
