<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import MarkdownEditor from '$lib/components/blog/MarkdownEditor.svelte';
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
	import { uploadProjectImage } from '$lib/api/projects';
	import { ApiError } from '$lib/api/client';
	import { mediaUrl } from '$lib/config';
	import { markdownToSafeHtml } from '$lib/markdown';
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
	let mdEditor = $state<{
		insertAround: (before: string, after?: string, placeholder?: string) => void;
		focus: () => void;
	} | null>(null);
	let coverFileInput = $state<HTMLInputElement | null>(null);

	let postId = $derived(page.params.id);

	let coverPreview = $derived(mediaUrl(coverImage));
	let previewHtml = $derived(markdownToSafeHtml(content));
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
	}

	async function loadPost(id: string): Promise<BlogPost | null> {
		try {
			return await getPost(id);
		} catch (err) {
			// Older core builds lack GET /posts/:id — fall back to list.
			if (err instanceof ApiError && err.status === 404) {
				const items = await listPosts();
				return items.find((p) => p.id === id) ?? null;
			}
			throw err;
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
			const loaded = await loadPost(id);
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
		// Debounced autosave for drafts only — intentional side effect.
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
				// Preserve first-publish date on updates and republish.
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

	function tool(action: string) {
		const insert = (before: string, after = '', placeholder = '') => {
			if (mdEditor) {
				mdEditor.insertAround(before, after, placeholder);
			} else {
				content = content + before + placeholder + after;
			}
		};
		switch (action) {
			case 'h2':
				insert('## ', '', 'Heading');
				break;
			case 'h3':
				insert('### ', '', 'Heading');
				break;
			case 'bold':
				insert('**', '**', 'bold');
				break;
			case 'italic':
				insert('*', '*', 'italic');
				break;
			case 'link':
				insert('[', '](https://)', 'label');
				break;
			case 'code':
				insert('```\n', '\n```', 'code');
				break;
			case 'list':
				insert('- ', '', 'item');
				break;
			case 'image':
				insert('![', '](https://)', 'alt');
				break;
		}
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

	async function onCoverFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		uploading = true;
		try {
			const res = await uploadProjectImage(file);
			coverImage = res.url;
			showToast('Cover uploaded', 'success');
		} catch (err) {
			showToast(uploadErrorMessage(err), 'error');
		} finally {
			uploading = false;
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

			<PageHeader title="Edit post" description="Write in Markdown — preview, save draft, or publish." />

			<Card variant="panel">
				<div class="fields">
					<Input label="Title" bind:value={title} oninput={syncSlugFromTitle} />
					<Input label="Slug" bind:value={slug} oninput={() => (slugTouched = true)} />
					<Textarea label="Excerpt" bind:value={excerpt} rows={2} />

					<div class="cover">
						<div class="cover-row">
							<div class="cover-input">
								<Input
									label="Cover image URL"
									bind:value={coverImage}
									placeholder="/uploads/… or https://"
								/>
							</div>
							<div class="cover-actions">
								<input
									bind:this={coverFileInput}
									type="file"
									accept="image/jpeg,image/png,image/webp"
									class="sr-only"
									onchange={onCoverFile}
								/>
								<Button
									variant="ghost"
									size="sm"
									disabled={uploading}
									on:click={() => coverFileInput?.click()}
								>
									{uploading ? 'Uploading…' : 'Upload'}
								</Button>
							</div>
						</div>
						{#if coverPreview}
							<img class="cover-thumb" src={coverPreview} alt="Cover preview" />
						{/if}
					</div>

					<Input label="Tags (comma-separated)" bind:value={tagsInput} />

					<div class="md-block">
						<div class="toolbar" role="toolbar" aria-label="Markdown">
							<button type="button" class="tool" onclick={() => tool('h2')} title="Heading 2"
								>H2</button
							>
							<button type="button" class="tool" onclick={() => tool('h3')} title="Heading 3"
								>H3</button
							>
							<button type="button" class="tool" onclick={() => tool('bold')} title="Bold"
								><strong>B</strong></button
							>
							<button type="button" class="tool" onclick={() => tool('italic')} title="Italic"
								><em>I</em></button
							>
							<button type="button" class="tool" onclick={() => tool('link')} title="Link"
								>Link</button
							>
							<button type="button" class="tool" onclick={() => tool('code')} title="Code fence"
								>Code</button
							>
							<button type="button" class="tool" onclick={() => tool('list')} title="List"
								>List</button
							>
							<button type="button" class="tool" onclick={() => tool('image')} title="Image"
								>Image</button
							>
						</div>
						<div class="content-label">
							<span class="label">Content (Markdown)</span>
							<MarkdownEditor
								bind:this={mdEditor}
								bind:value={content}
								ariaLabel="Post content Markdown"
							/>
						</div>
						<p class="counts">{wordCount} words · {charCount} characters</p>
					</div>
				</div>

				<div class="form-actions">
					<Button disabled={saving} on:click={() => save('draft')}>
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
						Published at <code>/u/&#123;your-handle&#125;/blog/{slug}</code> — paste that URL into
						project/experience write-up fields if you want.
					</p>
				{:else if isDirty}
					<p class="hint">Unsaved changes — drafts autosave after a short pause.</p>
				{/if}
			</Card>
		</div>

		{#if !previewHidden}
			<aside class="pane desktop" aria-label="Markdown preview">
				<div class="preview-toolbar">
					<span class="preview-title">Live preview</span>
				</div>
				{#if coverPreview}
					<img class="preview-cover" src={coverPreview} alt="" />
				{/if}
				{#if title.trim()}
					<h2 class="preview-post-title">{title}</h2>
				{/if}
				{#if excerpt.trim()}
					<p class="preview-excerpt">{excerpt}</p>
				{/if}
				<div class="preview-scroll">
					{#if previewHtml}
						<div class="preview-body">{@html previewHtml}</div>
					{:else}
						<p class="muted">Nothing to preview yet — start writing on the left.</p>
					{/if}
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
			<aside class="drawer mobile" aria-label="Markdown preview">
				<div class="preview-toolbar">
					<span class="preview-title">Live preview</span>
					<button type="button" class="toggle" onclick={() => (mobilePreviewOpen = false)}
						>Close</button
					>
				</div>
				<div class="preview-scroll drawer-scroll">
					{#if title.trim()}
						<h2 class="preview-post-title">{title}</h2>
					{/if}
					{#if previewHtml}
						<div class="preview-body">{@html previewHtml}</div>
					{:else}
						<p class="muted">Nothing to preview yet.</p>
					{/if}
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
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
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
	}
	.cover-actions {
		padding-bottom: 0.05rem;
	}
	.cover-thumb {
		display: block;
		margin-top: var(--space-2);
		max-width: 12rem;
		max-height: 8rem;
		object-fit: cover;
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
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
	.md-block {
		min-width: 0;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}
	.tool {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}
	.tool:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
	.content-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: 100%;
		min-width: 0;
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}
	.content-label :global(.cm-wrap) {
		width: 100%;
	}
	.counts {
		margin: var(--space-1) 0 0;
		font-size: 0.75rem;
		color: var(--color-muted);
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
	.preview-cover {
		display: block;
		width: 100%;
		max-height: 10rem;
		object-fit: cover;
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		flex-shrink: 0;
	}
	.preview-post-title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.25;
		flex-shrink: 0;
	}
	.preview-excerpt {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.4;
		flex-shrink: 0;
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
	.preview-body {
		padding: var(--space-4);
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.preview-body :global(h1),
	.preview-body :global(h2),
	.preview-body :global(h3) {
		margin: 1em 0 0.4em;
		line-height: 1.25;
	}
	.preview-body :global(p),
	.preview-body :global(ul),
	.preview-body :global(ol),
	.preview-body :global(blockquote) {
		margin: 0.65em 0;
	}
	.preview-body :global(pre) {
		padding: 0.75rem;
		overflow-x: auto;
		border-radius: var(--radius);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		font-size: 0.8125rem;
	}
	.preview-body :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.875em;
	}
	.preview-body :global(blockquote) {
		padding-left: 0.85rem;
		border-left: 3px solid var(--color-border);
		color: var(--color-muted);
	}
	.preview-body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius);
	}
	.preview-body :global(a) {
		color: var(--color-primary);
	}
	.preview-scroll > .muted {
		padding: var(--space-4);
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
