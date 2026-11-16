<script lang="ts">
	import {
		listUploadedMedia,
		uploadProjectImage,
		type MediaAsset
	} from '$lib/api/projects';
	import { ApiError } from '$lib/api/client';
	import { mediaUrl } from '$lib/config';
	import { showToast } from '$lib/stores/toast';

	type Mode = 'upload' | 'library' | 'url';

	let {
		value = $bindable(''),
		label = 'Image',
		hint = undefined as string | undefined,
		emptyHint = undefined as string | undefined,
		uploadToast = 'Image uploaded',
		onValueChange = undefined as ((url: string) => void) | undefined
	} = $props();

	let mode = $state<Mode>(/^https?:\/\//i.test(value.trim()) ? 'url' : 'upload');
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let dragging = $state(false);
	let dragDepth = $state(0);

	const attachFileInput = (node: HTMLInputElement) => {
		fileInput = node;
		return () => {
			if (fileInput === node) fileInput = null;
		};
	};

	let libraryItems = $state.raw<MediaAsset[]>([]);
	let libraryLoading = $state(false);
	let libraryLoaded = $state(false);
	let libraryError = $state('');

	const previewSrc = $derived(mediaUrl(value));

	function setValue(url: string) {
		value = url;
		onValueChange?.(url);
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

	async function refreshLibrary() {
		libraryLoading = true;
		libraryError = '';
		try {
			const res = await listUploadedMedia();
			libraryItems = res.items ?? [];
			libraryLoaded = true;
		} catch (err) {
			libraryError =
				err instanceof ApiError
					? err.message.slice(0, 160) || 'Could not load library'
					: 'Could not load library';
			libraryItems = [];
		} finally {
			libraryLoading = false;
		}
	}

	function selectMode(next: Mode) {
		mode = next;
		if (next === 'library' && !libraryLoaded && !libraryLoading) {
			void refreshLibrary();
		}
	}

	async function uploadFile(file: File) {
		uploading = true;
		try {
			const res = await uploadProjectImage(file);
			setValue(res.url);
			mode = 'upload';
			showToast(uploadToast, 'success');
			libraryLoaded = false;
			void refreshLibrary();
		} catch (err) {
			showToast(uploadErrorMessage(err), 'error');
		} finally {
			uploading = false;
		}
	}

	async function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) await uploadFile(file);
	}

	function onDragEnter(e: DragEvent) {
		e.preventDefault();
		dragDepth += 1;
		dragging = true;
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave(e: DragEvent) {
		e.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dragging = false;
	}

	async function onDrop(e: DragEvent) {
		e.preventDefault();
		dragDepth = 0;
		dragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) await uploadFile(file);
	}

	function clearImage() {
		setValue('');
	}

	function selectLibraryItem(item: MediaAsset) {
		setValue(item.url);
	}

	function onUrlInput(e: Event) {
		setValue((e.currentTarget as HTMLInputElement).value);
	}
</script>

<div class="image-field">
	<span class="label">{label}</span>
	{#if hint}
		<p class="hint">{hint}</p>
	{/if}

	<div class="tabs" role="tablist" aria-label="{label} source">
		<button
			type="button"
			class={['tab', { active: mode === 'upload' }]}
			role="tab"
			aria-selected={mode === 'upload'}
			onclick={() => selectMode('upload')}
		>
			Upload
		</button>
		<button
			type="button"
			class={['tab', { active: mode === 'library' }]}
			role="tab"
			aria-selected={mode === 'library'}
			onclick={() => selectMode('library')}
		>
			Library
		</button>
		<button
			type="button"
			class={['tab', { active: mode === 'url' }]}
			role="tab"
			aria-selected={mode === 'url'}
			onclick={() => selectMode('url')}
		>
			URL
		</button>
	</div>

	{#if mode === 'upload'}
		<input
			{@attach attachFileInput}
			type="file"
			accept="image/jpeg,image/png,image/webp"
			hidden
			disabled={uploading}
			onchange={onFileChange}
		/>
		<div
			class={[
				'dropzone',
				{
					filled: Boolean(previewSrc),
					dragging,
					busy: uploading
				}
			]}
			role="button"
			tabindex="0"
			aria-label={previewSrc ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
			onclick={() => !uploading && fileInput?.click()}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					if (!uploading) fileInput?.click();
				}
			}}
			ondragenter={onDragEnter}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
			ondrop={onDrop}
		>
			{#if previewSrc}
				<img class="dropzone-img" src={previewSrc} alt="" />
				<div class="dropzone-veil">
					<span class="dropzone-cta">{uploading ? 'Uploading…' : 'Drop to replace, or click'}</span>
				</div>
			{:else}
				<svg
					class="dropzone-icon"
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<rect
						x="3"
						y="5"
						width="18"
						height="14"
						rx="2.5"
						stroke="currentColor"
						stroke-width="1.6"
					/>
					<circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
					<path
						d="M7 17l3.4-3.8a1.2 1.2 0 0 1 1.8 0L16 17h2l-4.2-5.2a1.6 1.6 0 0 0-2.5 0L7 17z"
						fill="currentColor"
					/>
				</svg>
				<strong>{uploading ? 'Uploading…' : dragging ? 'Drop image' : 'Drop image here'}</strong>
				<span>or click to browse · JPEG, PNG, WebP · 3 MB max</span>
			{/if}
		</div>
		{#if previewSrc}
			<div class="dropzone-bar">
				<button
					type="button"
					class="chip"
					disabled={uploading}
					onclick={(e) => {
						e.stopPropagation();
						fileInput?.click();
					}}
				>
					Change
				</button>
				<button
					type="button"
					class="chip danger"
					disabled={uploading}
					onclick={(e) => {
						e.stopPropagation();
						clearImage();
					}}
				>
					Remove
				</button>
			</div>
		{:else if emptyHint}
			<p class="hint">{emptyHint}</p>
		{/if}
	{:else if mode === 'library'}
		{#if libraryLoading && !libraryLoaded}
			<p class="hint">Loading library…</p>
		{:else if libraryError}
			<div class="library-status">
				<p class="error">{libraryError}</p>
				<button type="button" class="chip" onclick={() => void refreshLibrary()}>Retry</button>
			</div>
		{:else if libraryItems.length === 0}
			<p class="hint">No uploaded images yet</p>
		{:else}
			<div class="library-grid">
				{#each libraryItems as item (item.id)}
					<button
						type="button"
						class={['thumb', { selected: value === item.url }]}
						onclick={() => selectLibraryItem(item)}
						aria-label="Select uploaded image"
						aria-pressed={value === item.url}
					>
						<img src={mediaUrl(item.url)} alt="" />
					</button>
				{/each}
			</div>
		{/if}
		<p class="manage">
			<a href="/media">Manage media</a>
		</p>
		{#if previewSrc}
			<div class="dropzone-bar">
				<button type="button" class="chip danger" onclick={clearImage}>Remove</button>
			</div>
		{:else if emptyHint}
			<p class="hint">{emptyHint}</p>
		{/if}
	{:else}
		<label class="url-field">
			<span class="url-label">Image URL</span>
			<input type="url" value={value} placeholder="https://…" oninput={onUrlInput} />
		</label>
		{#if previewSrc}
			<img class="url-preview" src={previewSrc} alt="" />
			<div class="dropzone-bar">
				<button type="button" class="chip danger" onclick={clearImage}>Remove</button>
			</div>
		{:else if emptyHint}
			<p class="hint">{emptyHint}</p>
		{/if}
	{/if}
</div>

<style>
	.image-field {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted, var(--muted, #78716c));
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.2rem;
		border-radius: 0.55rem;
		background: var(--color-bg, var(--bg-muted, #f5f5f4));
		border: 1px solid var(--color-border, var(--line, #e7e5e4));
		width: fit-content;
		max-width: 100%;
	}
	.tab {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--color-muted, var(--muted, #78716c));
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.35rem 0.7rem;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.tab.active {
		background: var(--color-surface, var(--surface, #fff));
		color: var(--color-text, inherit);
		box-shadow: 0 1px 2px color-mix(in srgb, #0f172a 8%, transparent);
	}
	.dropzone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 9.5rem;
		padding: 1.1rem;
		border: 1.5px dashed
			color-mix(
				in srgb,
				var(--color-primary, var(--accent, #0f766e)) 28%,
				var(--color-border, var(--line, #e7e5e4))
			);
		border-radius: 0.65rem;
		background: var(--color-bg, var(--bg-muted, #f5f5f4));
		color: var(--color-muted, var(--muted, #78716c));
		text-align: center;
		cursor: pointer;
		overflow: hidden;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			box-shadow 0.15s ease;
	}
	.dropzone:hover,
	.dropzone:focus-visible {
		border-color: var(--color-primary, var(--accent, #0f766e));
		outline: none;
		box-shadow: 0 0 0 3px
			color-mix(in srgb, var(--color-primary, var(--accent, #0f766e)) 18%, transparent);
	}
	.dropzone.dragging {
		border-style: solid;
		border-color: var(--color-primary, var(--accent, #0f766e));
		background: color-mix(
			in srgb,
			var(--color-primary, var(--accent, #0f766e)) 10%,
			var(--color-surface, var(--surface, #fff))
		);
	}
	.dropzone.busy {
		pointer-events: none;
		opacity: 0.75;
	}
	.dropzone.filled {
		padding: 0;
		border-style: solid;
		background: var(--color-surface, var(--surface, #fff));
	}
	.dropzone-icon {
		color: var(--color-primary, var(--accent, #0f766e));
		margin-bottom: 0.15rem;
	}
	.dropzone strong {
		color: inherit;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.dropzone span {
		font-size: 0.75rem;
	}
	.dropzone-img,
	.url-preview {
		display: block;
		width: 100%;
		height: 9.5rem;
		object-fit: cover;
		border-radius: 0.55rem;
	}
	.dropzone-img {
		border-radius: 0;
	}
	.dropzone-veil {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, #0f172a 48%, transparent);
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.dropzone.filled:hover .dropzone-veil,
	.dropzone.filled:focus-visible .dropzone-veil,
	.dropzone.dragging .dropzone-veil,
	.dropzone.busy .dropzone-veil {
		opacity: 1;
	}
	.dropzone-cta {
		color: #fff !important;
		font-size: 0.8125rem !important;
		font-weight: 600;
	}
	.dropzone-bar {
		display: flex;
		gap: 0.4rem;
	}
	.chip {
		padding: 0.28rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--color-border, var(--line, #e7e5e4));
		background: var(--color-surface, var(--surface, #fff));
		color: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--color-primary, var(--accent, #0f766e));
		color: var(--color-primary, var(--accent, #0f766e));
	}
	.chip.danger:hover:not(:disabled) {
		border-color: color-mix(in srgb, #b91c1c 35%, var(--color-border, var(--line, #e7e5e4)));
		color: #b91c1c;
		background: #fef2f2;
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.library-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(4.75rem, 1fr));
		gap: 0.45rem;
	}
	.thumb {
		appearance: none;
		border: 1.5px solid var(--color-border, var(--line, #e7e5e4));
		border-radius: 0.45rem;
		padding: 0;
		overflow: hidden;
		aspect-ratio: 1;
		cursor: pointer;
		background: var(--color-bg, var(--bg-muted, #f5f5f4));
	}
	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.thumb.selected,
	.thumb:hover {
		border-color: var(--color-primary, var(--accent, #0f766e));
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--color-primary, var(--accent, #0f766e)) 22%, transparent);
	}
	.library-status {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.45rem;
	}
	.manage {
		margin: 0;
		font-size: 0.75rem;
	}
	.manage a {
		color: var(--color-primary, var(--accent, #0f766e));
		text-decoration: none;
		font-weight: 600;
	}
	.manage a:hover {
		text-decoration: underline;
	}
	.error {
		margin: 0;
		color: #b91c1c;
		font-size: 0.8125rem;
	}
	.url-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.url-label {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.url-field input {
		font: inherit;
		padding: 0.5rem 0.65rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border, var(--line, #e7e5e4));
		background: var(--color-surface, var(--surface, #fff));
		color: inherit;
	}
</style>
