<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import PostBodyEditor from '$lib/components/blog/PostBodyEditor.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		getPost,
		listPosts,
		updatePost,
		deletePost,
		slugify,
		tagsToJson,
		tagsFromJson,
		type BlogPost
	} from '$lib/api/blog';
	import { listPortfolios } from '$lib/api/portfolios';
	import { uploadProjectImage } from '$lib/api/projects';
	import { ApiError } from '$lib/api/client';
	import { mediaUrl } from '$lib/config';
	import { markdownToSafeHtml } from '$lib/markdown';
	import { getThemePreviewCss, normalizeThemeSlug } from '$lib/blog/themeCss';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	type FormSnapshot = {
		title: string;
		slug: string;
		excerpt: string;
		coverImage: string;
		tagsInput: string;
		content: string;
		status: 'draft' | 'published';
		published_at: string | null;
	};

	let loading = $state(true);
	let saving = $state(false);
	let uploading = $state(false);
	let post = $state<BlogPost | null>(null);
	let previewHidden = $state(false);
	let mobilePreviewOpen = $state(false);
	let detailsOpen = $state(true);
	let themeSlug = $state('minimal');

	let title = $state('');
	let slug = $state('');
	let excerpt = $state('');
	let coverImage = $state('');
	let tagsInput = $state('');
	let content = $state('');
	let status = $state<'draft' | 'published'>('draft');
	let publishedAt = $state<string | null>(null);
	let slugTouched = $state(false);

	let saved = $state<FormSnapshot | null>(null);
	let bodyEditor = $state<{
		focus: () => void;
		insertImage: (url: string, alt?: string) => void;
	} | null>(null);
	let coverFileInput = $state<HTMLInputElement | null>(null);
	/** Bumps to force cover preview/input remount after async updates. */
	let coverEpoch = $state(0);

	let postId = $derived(page.params.id);

	let coverPreview = $derived(mediaUrl(coverImage));
	let previewHtml = $derived(markdownToSafeHtml(content));
	let themeCss = $derived(getThemePreviewCss(themeSlug));
	let themeClass = $derived(`blog-theme-preview theme-${normalizeThemeSlug(themeSlug)}`);
	let charCount = $derived(content.length);
	let wordCount = $derived(
		content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0
	);

	let isDirty = $derived.by(() => {
		if (!saved) return false;
		return (
			title !== saved.title ||
			slug !== saved.slug ||
			excerpt !== saved.excerpt ||
			coverImage !== saved.coverImage ||
			tagsInput !== saved.tagsInput ||
			content !== saved.content ||
			status !== saved.status
		);
	});

	function snapshotFromForm(): FormSnapshot {
		return {
			title,
			slug,
			excerpt,
			coverImage,
			tagsInput,
			content,
			status,
			published_at: publishedAt
		};
	}

	function fillForm(p: BlogPost) {
		title = p.title;
		slug = p.slug;
		excerpt = p.excerpt;
		coverImage = p.cover_image;
		coverEpoch += 1;
		tagsInput = tagsFromJson(p.tags);
		content = p.content;
		status = p.status;
		publishedAt = p.published_at;
		slugTouched = true;
		saved = {
			title: p.title,
			slug: p.slug,
			excerpt: p.excerpt,
			coverImage: p.cover_image,
			tagsInput: tagsFromJson(p.tags),
			content: p.content,
			status: p.status,
			published_at: p.published_at
		};
		// Collapse details once optional metadata is already filled in.
		detailsOpen = !(p.excerpt || p.cover_image || tagsFromJson(p.tags));
	}

	async function loadPost(id: string): Promise<BlogPost | null> {
		try {
			return await getPost(id);
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				const items = await listPosts();
				return items.find((p) => p.id === id) ?? null;
			}
			throw err;
		}
	}

	async function loadTheme() {
		try {
			const portfolios = await listPortfolios();
			const preferred =
				portfolios.find((p) => p.is_default === 1) ??
				portfolios.find((p) => p.show_posts === 1) ??
				portfolios[0];
			themeSlug = normalizeThemeSlug(preferred?.theme_slug);
		} catch {
			themeSlug = 'minimal';
		}
	}

	async function load() {
		const id = postId;
		if (!id) {
			showToast('Post not found', 'error');
			goto('/blog');
			return;
		}
		loading = true;
		try {
			const [loaded] = await Promise.all([loadPost(id), loadTheme()]);
			if (!loaded) {
				showToast('Post not found', 'error');
				goto('/blog');
				return;
			}
			post = loaded;
			fillForm(loaded);
		} catch {
			showToast('Failed to load post', 'error');
			goto('/blog');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function syncSlugFromTitle(e: Event) {
		const next = (e.currentTarget as HTMLInputElement).value;
		if (!slugTouched && next) {
			slug = slugify(next);
		}
	}

	$effect(() => {
		if (loading || !post || saving || status !== 'draft' || !isDirty) return;
		const timer = setTimeout(() => {
			void save('draft', { silent: true });
		}, 2500);
		return () => clearTimeout(timer);
	});

	function payload(overrides: Partial<BlogPost> = {}): Partial<BlogPost> {
		return {
			title: title.trim(),
			slug: slug.trim(),
			excerpt,
			cover_image: coverImage,
			tags: tagsToJson(tagsInput),
			content,
			status,
			...overrides
		};
	}

	async function save(
		mode: 'draft' | 'publish' | 'unpublish',
		opts: { silent?: boolean } = {}
	) {
		if (!post || !title.trim() || !slug.trim()) {
			if (!opts.silent) showToast('Title and slug are required', 'error');
			return;
		}
		saving = true;
		try {
			let nextStatus: 'draft' | 'published' = status;
			let nextPublishedAt = publishedAt;
			const body: Partial<BlogPost> = payload();

			if (mode === 'draft' || mode === 'unpublish') {
				nextStatus = 'draft';
				body.status = 'draft';
				body.published_at = publishedAt;
			} else {
				nextStatus = 'published';
				body.status = 'published';
				if (publishedAt) {
					body.published_at = publishedAt;
					nextPublishedAt = publishedAt;
				} else {
					nextPublishedAt = new Date().toISOString();
					body.published_at = nextPublishedAt;
				}
			}

			await updatePost(post.id, body);
			status = nextStatus;
			publishedAt = nextPublishedAt;
			post = { ...post, status: nextStatus, published_at: nextPublishedAt };
			saved = snapshotFromForm();

			if (!opts.silent) {
				if (mode === 'publish') showToast('Post published', 'success');
				else if (mode === 'unpublish') showToast('Post unpublished', 'success');
				else showToast('Draft saved', 'success');
			}
		} catch {
			if (!opts.silent) showToast('Failed to save post', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!post) return;
		if (!(await confirmDelete(post.title?.trim() || 'this post'))) return;
		try {
			await deletePost(post.id);
			saved = snapshotFromForm();
			showToast('Post deleted', 'success');
			goto('/blog');
		} catch {
			showToast('Failed to delete post', 'error');
		}
	}

	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (!isDirty) return;
		e.preventDefault();
		e.returnValue = '';
	}

	function uploadErrorMessage(err: unknown): string {
		if (err instanceof ApiError) {
			try {
				const parsed = JSON.parse(err.message) as { message?: string; error?: string };
				if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
				if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
			} catch {
				if (err.message && !err.message.startsWith('<')) return err.message.slice(0, 160);
			}
		}
		return 'Image upload failed — try JPEG, PNG, or WebP under 3 MB';
	}

	async function uploadImage(file: File): Promise<string | null> {
		uploading = true;
		try {
			const res = await uploadProjectImage(file);
			showToast('Image uploaded', 'success');
			return res.url;
		} catch (err) {
			showToast(uploadErrorMessage(err), 'error');
			return null;
		} finally {
			uploading = false;
		}
	}

	function setCoverLocal(next: string) {
		coverImage = next;
		coverEpoch += 1;
		if (coverFileInput) coverFileInput.value = '';
	}

	async function persistCover(next: string): Promise<boolean> {
		if (!post) return false;
		try {
			await updatePost(post.id, { cover_image: next });
			post = { ...post, cover_image: next };
			if (saved) saved = { ...saved, coverImage: next };
			return true;
		} catch {
			return false;
		}
	}

	async function onCoverFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !post || uploading || saving) return;

		const previous = coverImage;
		const url = await uploadImage(file);
		if (!url) return;

		// Update UI first (do not disable the text field — that can fight bind:value).
		setCoverLocal(url);

		saving = true;
		try {
			const ok = await persistCover(url);
			if (!ok) {
				setCoverLocal(previous);
				showToast('Cover uploaded but failed to save on the post', 'error');
			}
		} finally {
			saving = false;
		}
	}

	async function clearCoverImage(e?: Event) {
		e?.preventDefault();
		e?.stopPropagation();
		if (!post || uploading || saving) return;
		if (!coverImage.trim()) return;

		const previous = coverImage;
		setCoverLocal('');

		saving = true;
		try {
			const ok = await persistCover('');
			if (!ok) {
				setCoverLocal(previous);
				showToast('Failed to remove cover', 'error');
				return;
			}
			showToast('Cover removed', 'success');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

{#if loading}
	<p class="muted">Loading…</p>
{:else if post}
	<div class="editor-with-preview" class:preview-hidden={previewHidden}>
		<div class="editor">
			<div class="preview-toggle-bar desktop-only">
				<button type="button" class="toggle" onclick={() => (previewHidden = !previewHidden)}>
					{previewHidden ? 'Show preview' : 'Hide preview'}
				</button>
			</div>

			<div class="title-row">
				<PageHeader
					title="Edit post"
					description="Write visually — content is saved as Markdown and styled by your portfolio theme."
				/>
				<span class="status-chip" class:published={status === 'published'}>
					{status === 'published' ? 'Published' : 'Draft'}
				</span>
			</div>

			<Card variant="panel">
				<div class="fields">
					<div class="title-field">
						<Input
							label="Title"
							bind:value={title}
							oninput={syncSlugFromTitle}
							placeholder="Post title"
						/>
					</div>

					<div class="body-block">
						<span class="label">Content</span>
						<PostBodyEditor
							bind:this={bodyEditor}
							bind:value={content}
							uploading={uploading}
							onUploadImage={uploadImage}
							ariaLabel="Post content"
							minHeight="18rem"
						/>
						<p class="counts">{wordCount} words · {charCount} characters</p>
					</div>

					<details class="details" bind:open={detailsOpen}>
						<summary>Post details</summary>
						<div class="details-body">
							<Input label="Slug" bind:value={slug} oninput={() => (slugTouched = true)} />
							<Textarea label="Excerpt" bind:value={excerpt} rows={2} />

							<div class="cover">
								<div class="cover-row">
									{#key coverEpoch}
										<label class="cover-input">
											<span class="label">Cover image URL</span>
											<input
												type="text"
												value={coverImage}
												placeholder="/uploads/… or https://"
												oninput={(e) => {
													coverImage = (e.currentTarget as HTMLInputElement).value;
												}}
											/>
										</label>
									{/key}
									<div class="cover-actions">
										<input
											bind:this={coverFileInput}
											type="file"
											accept="image/jpeg,image/png,image/webp"
											class="sr-only"
											onchange={onCoverFile}
										/>
										<button
											type="button"
											class="cover-btn"
											disabled={uploading || saving}
											onclick={() => coverFileInput?.click()}
										>
											{uploading ? 'Uploading…' : coverPreview ? 'Replace' : 'Upload'}
										</button>
										{#if coverImage.trim()}
											<button
												type="button"
												class="cover-btn"
												disabled={uploading || saving}
												onclick={(e) => void clearCoverImage(e)}
											>
												Remove
											</button>
										{/if}
									</div>
								</div>
								{#key coverEpoch}
									{#if coverPreview}
										<div class="cover-preview">
											<img class="cover-thumb" src={coverPreview} alt="Cover preview" />
											<button
												type="button"
												class="cover-clear"
												disabled={uploading || saving}
												onclick={(e) => void clearCoverImage(e)}
												aria-label="Remove cover image"
												title="Remove cover image"
											>
												<span aria-hidden="true">×</span>
											</button>
										</div>
									{/if}
								{/key}
							</div>

							<Input label="Tags (comma-separated)" bind:value={tagsInput} />
						</div>
					</details>
				</div>

				<div class="form-actions">
					<Button variant="ghost" disabled={saving} on:click={() => save('draft')}>
						{saving ? 'Saving…' : 'Save draft'}
					</Button>
					<Button disabled={saving} on:click={() => save('publish')}>
						{status === 'published' ? 'Update published' : 'Publish'}
					</Button>
					{#if status === 'published'}
						<Button variant="ghost" size="sm" disabled={saving} on:click={() => save('unpublish')}>
							Unpublish
						</Button>
					{/if}
					<Button variant="ghost" size="sm" on:click={() => goto('/blog')}>Back</Button>
					<Button variant="ghost" size="sm" on:click={remove}>Delete</Button>
				</div>

				{#if status === 'published'}
					<p class="hint">
						Published at <code>/u/&#123;your-handle&#125;/blog/{slug}</code>
					</p>
				{:else if isDirty}
					<p class="hint">Unsaved changes — drafts autosave after a short pause.</p>
				{/if}
			</Card>
		</div>

		{#if !previewHidden}
			<aside class="pane desktop" aria-label="Theme preview">
				<div class="preview-toolbar">
					<span class="preview-title">Live preview · {normalizeThemeSlug(themeSlug)}</span>
				</div>
				<div class="preview-scroll">
					<div class={themeClass}>
						{@html `<style>${themeCss}</style>`}
						{#key coverEpoch}
							{#if coverPreview}
								<img class="post-cover post-cover-hero" src={coverPreview} alt="" />
							{/if}
						{/key}
						{#if title.trim()}
							<header class="hero"><div><h1>{title}</h1></div></header>
						{/if}
						{#if excerpt.trim()}
							<p class="headline">{excerpt}</p>
						{/if}
						{#if previewHtml}
							<div class="prose">{@html previewHtml}</div>
						{:else}
							<p class="muted">Nothing to preview yet — start writing on the left.</p>
						{/if}
					</div>
				</div>
			</aside>
		{/if}

		<button type="button" class="fab mobile" onclick={() => (mobilePreviewOpen = true)}>
			Preview
		</button>

		{#if mobilePreviewOpen}
			<div
				class="overlay mobile"
				role="presentation"
				onclick={() => (mobilePreviewOpen = false)}
			></div>
			<aside class="drawer mobile" aria-label="Theme preview">
				<div class="preview-toolbar">
					<span class="preview-title">Live preview · {normalizeThemeSlug(themeSlug)}</span>
					<button type="button" class="toggle" onclick={() => (mobilePreviewOpen = false)}
						>Close</button
					>
				</div>
				<div class="preview-scroll drawer-scroll">
					<div class={themeClass}>
						{@html `<style>${themeCss}</style>`}
						{#if title.trim()}
							<header class="hero"><div><h1>{title}</h1></div></header>
						{/if}
						{#if previewHtml}
							<div class="prose">{@html previewHtml}</div>
						{:else}
							<p class="muted">Nothing to preview yet.</p>
						{/if}
					</div>
				</div>
			</aside>
		{/if}
	</div>
{/if}

<style>
	.muted {
		color: var(--color-muted);
		font-size: 0.875rem;
	}
	.editor-with-preview {
		display: flex;
		align-items: stretch;
		gap: var(--space-3);
		min-height: 100%;
		width: 100%;
	}
	.editor {
		flex: 1 1 48%;
		min-width: 0;
	}
	.editor-with-preview.preview-hidden .editor {
		flex: 1 1 auto;
		max-width: 44rem;
	}
	.preview-toggle-bar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-2);
	}
	.toggle {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius);
		padding: 0.25rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-muted);
		cursor: pointer;
	}
	.toggle:hover {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.title-row :global(.page-header) {
		margin-bottom: 0;
	}
	.status-chip {
		flex-shrink: 0;
		margin-top: 0.35rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border: 1px solid var(--color-border);
		color: var(--color-muted);
		background: var(--color-surface);
	}
	.status-chip.published {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.title-field :global(input) {
		font-size: 1.125rem;
		font-weight: 600;
	}
	.body-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}
	.counts {
		margin: var(--space-1) 0 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.details {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		padding: 0.35rem 0.85rem 0.85rem;
	}
	.details summary {
		cursor: pointer;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-muted);
		padding: 0.5rem 0;
		list-style: none;
	}
	.details summary::-webkit-details-marker {
		display: none;
	}
	.details summary::before {
		content: '▸ ';
		display: inline-block;
		transition: transform 0.15s ease;
	}
	.details[open] summary::before {
		transform: rotate(90deg);
	}
	.details-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-1);
	}
	.cover-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: flex-end;
	}
	.cover-input {
		flex: 1 1 16rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.cover-input input {
		min-height: var(--control-height);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
	}
	.cover-input input:focus {
		border-color: var(--color-primary-muted);
		box-shadow: var(--focus-ring);
		outline: none;
	}
	.cover-input input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.cover-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding-bottom: 0.05rem;
	}
	.cover-btn {
		min-height: 1.875rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
	}
	.cover-btn:hover:not(:disabled) {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.cover-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.cover-preview {
		position: relative;
		display: inline-block;
		margin-top: var(--space-2);
		max-width: 12rem;
		isolation: isolate;
	}
	.cover-thumb {
		display: block;
		width: 100%;
		max-height: 8rem;
		object-fit: cover;
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		pointer-events: none;
	}
	.cover-clear {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 1.15rem;
		line-height: 1;
		cursor: pointer;
		box-shadow: var(--shadow-sm);
	}
	.cover-clear:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.cover-clear:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.pane.desktop {
		position: sticky;
		top: 0;
		align-self: start;
		flex: 1 1 52%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		height: 100cqh;
		max-height: 100cqh;
	}
	.preview-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		flex-shrink: 0;
	}
	.preview-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.preview-scroll {
		flex: 1 1 0;
		min-height: 0;
		overflow: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		box-shadow: var(--shadow-sm);
	}
	.preview-scroll :global(.blog-theme-preview) {
		padding: var(--space-4);
		min-height: 100%;
		box-sizing: border-box;
	}
	.preview-scroll :global(.blog-theme-preview .muted) {
		margin: 0;
	}
	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
	}
	.hint {
		margin: var(--space-3) 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	code {
		background: var(--color-primary-light);
		color: var(--color-primary);
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-sm);
	}
	.fab,
	.overlay,
	.drawer {
		display: none;
	}

	@media (max-width: 1099px) {
		.editor-with-preview {
			display: block;
			min-height: 0;
		}
		.desktop-only,
		.pane.desktop {
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
			box-shadow: var(--shadow-md);
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
			gap: var(--space-2);
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(100vw, 420px);
			z-index: 60;
			padding: var(--space-4);
			background: var(--color-bg);
			border-left: 1px solid var(--color-border);
			box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
		}
		.drawer-scroll {
			flex: 1;
			min-height: 0;
		}
	}
</style>
