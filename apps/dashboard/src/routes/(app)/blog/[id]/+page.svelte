<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		listPosts,
		updatePost,
		deletePost,
		slugify,
		tagsToJson,
		tagsFromJson,
		type BlogPost
	} from '$lib/api/blog';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let loading = true;
	let saving = false;
	let post: BlogPost | null = null;

	let title = '';
	let slug = '';
	let excerpt = '';
	let coverImage = '';
	let tagsInput = '';
	let content = '';
	let status: 'draft' | 'published' = 'draft';
	let slugTouched = false;

	$: postId = $page.params.id;

	onMount(load);

	async function load() {
		loading = true;
		try {
			const items = await listPosts();
			post = items.find((p) => p.id === postId) ?? null;
			if (!post) {
				showToast('Post not found', 'error');
				goto('/blog');
				return;
			}
			fillForm(post);
		} catch {
			showToast('Failed to load post', 'error');
			goto('/blog');
		} finally {
			loading = false;
		}
	}

	function fillForm(p: BlogPost) {
		title = p.title;
		slug = p.slug;
		excerpt = p.excerpt;
		coverImage = p.cover_image;
		tagsInput = tagsFromJson(p.tags);
		content = p.content;
		status = p.status;
		slugTouched = true;
	}

	$: if (!slugTouched && title) {
		slug = slugify(title);
	}

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

	async function save(asPublished = false) {
		if (!post || !title.trim() || !slug.trim()) {
			showToast('Title and slug are required', 'error');
			return;
		}
		saving = true;
		const nextStatus = asPublished ? 'published' : status;
		try {
			await updatePost(post.id, payload({
				status: nextStatus,
				published_at: asPublished || nextStatus === 'published'
					? new Date().toISOString()
					: post.published_at
			}));
			status = nextStatus;
			showToast(asPublished ? 'Post published' : 'Draft saved', 'success');
		} catch {
			showToast('Failed to save post', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!post) return;
		if (!(await confirmDelete(post.title?.trim() || 'this post'))) return;
		try {
			await deletePost(post.id);
			showToast('Post deleted', 'success');
			goto('/blog');
		} catch {
			showToast('Failed to delete post', 'error');
		}
	}
</script>

{#if loading}
	<p class="muted">Loading…</p>
{:else if post}
	<PageHeader title="Edit post" description="Markdown content — save draft or publish." />

	<Card>
		<div class="fields">
			<Input label="Title" bind:value={title} />
			<Input label="Slug" bind:value={slug} on:input={() => (slugTouched = true)} />
			<Textarea label="Excerpt" bind:value={excerpt} rows={2} />
			<Input label="Cover image URL" bind:value={coverImage} />
			<Input label="Tags (comma-separated)" bind:value={tagsInput} />
			<Textarea label="Content (Markdown)" bind:value={content} rows={16} />
		</div>
		<div class="form-actions">
			<Button disabled={saving} on:click={() => save(false)}>
				{saving ? 'Saving…' : 'Save draft'}
			</Button>
			<Button disabled={saving} on:click={() => save(true)}>
				{status === 'published' ? 'Update published' : 'Publish'}
			</Button>
			<Button variant="ghost" on:click={() => goto('/blog')}>Back</Button>
			<Button variant="ghost" on:click={remove}>Delete</Button>
		</div>
		{#if status === 'published'}
			<p class="hint">Published posts are visible at <code>/u/your-handle/blog/{slug}</code> once public pages are live.</p>
		{/if}
	</Card>
{/if}

<style>
	.muted {
		color: var(--color-muted);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
	.hint {
		margin: 1rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	code {
		background: var(--color-primary-light);
		color: var(--color-primary);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}
</style>
