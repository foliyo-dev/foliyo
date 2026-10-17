<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import UpgradePrompt from '$lib/components/UpgradePrompt.svelte';
	import {
		createPost,
		deletePost,
		listPosts,
		slugify,
		updatePost,
		type BlogPost
	} from '$lib/api/blog';
	import { ApiError } from '$lib/api/client';
	import { getPlan, type PlanInfo } from '$lib/api/plan';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';
	import { user } from '$lib/stores/auth';
	import { isSaas, siteUrl } from '$lib/config';

	let loading = $state(true);
	let creating = $state(false);
	let posts = $state<BlogPost[]>([]);
	let planInfo = $state<PlanInfo | null>(null);
	let showUpgrade = $state(false);
	let upgradeMessage = $state('');
	let busyId = $state<string | null>(null);

	let handle = $derived($user?.handle ?? '');
	// Self-host unlocks all Pro features; hosted Free needs upgrade.
	let canBlog = $derived(
		!isSaas ||
			planInfo?.entitlements?.user_blog === true ||
			['pro', 'lifetime', 'selfhost'].includes(
				(planInfo?.plan ?? $user?.plan ?? '').toLowerCase()
			)
	);

	onMount(async () => {
		loading = true;
		try {
			const [items, plan] = await Promise.all([listPosts(), getPlan().catch(() => null)]);
			posts = items;
			planInfo = plan;
		} catch {
			showToast('Failed to load posts', 'error');
		} finally {
			loading = false;
		}
	});

	async function newPost() {
		creating = true;
		showUpgrade = false;
		try {
			const title = 'Untitled post';
			const created = await createPost({
				title,
				slug: slugify(`${title}-${Date.now()}`),
				content: '',
				excerpt: '',
				cover_image: '',
				tags: '[]',
				status: 'draft'
			});
			const newest = created[0];
			if (newest?.id) {
				goto(`/blog/${newest.id}`);
				return;
			}
			showToast('Post created', 'success');
			posts = created;
		} catch (err) {
			if (err instanceof ApiError && err.status === 402) {
				try {
					const body = JSON.parse(err.message) as { message?: string };
					upgradeMessage = body.message || 'Upgrade to Pro to write blog posts.';
				} catch {
					upgradeMessage = 'Upgrade to Pro to write blog posts.';
				}
				showUpgrade = true;
			} else {
				showToast('Could not create post', 'error');
			}
		} finally {
			creating = false;
		}
	}

	async function togglePublish(post: BlogPost) {
		if (busyId) return;
		busyId = post.id;
		const nextStatus = post.status === 'published' ? 'draft' : 'published';
		try {
			const body: Partial<BlogPost> = { status: nextStatus };
			if (nextStatus === 'published' && !post.published_at) {
				body.published_at = new Date().toISOString();
			}
			await updatePost(post.id, body);
			posts = posts.map((p) =>
				p.id === post.id
					? {
							...p,
							status: nextStatus,
							published_at: body.published_at ?? p.published_at
						}
					: p
			);
			showToast(nextStatus === 'published' ? 'Post published' : 'Post unpublished', 'success');
		} catch (err) {
			if (err instanceof ApiError && err.status === 402) {
				try {
					const parsed = JSON.parse(err.message) as { message?: string };
					upgradeMessage = parsed.message || 'Upgrade to Pro to publish blog posts.';
				} catch {
					upgradeMessage = 'Upgrade to Pro to publish blog posts.';
				}
				showUpgrade = true;
			} else {
				showToast('Could not update post', 'error');
			}
		} finally {
			busyId = null;
		}
	}

	async function remove(post: BlogPost) {
		if (!(await confirmDelete(post.title?.trim() || 'this post'))) return;
		busyId = post.id;
		try {
			await deletePost(post.id);
			posts = posts.filter((p) => p.id !== post.id);
			showToast('Post deleted', 'success');
		} catch {
			showToast('Failed to delete post', 'error');
		} finally {
			busyId = null;
		}
	}

	function publicUrl(slug: string): string {
		const base = siteUrl.replace(/\/$/, '');
		return handle ? `${base}/u/${handle}/blog/${slug}` : '';
	}
</script>

<div class="blog-list-page">
	<PageHeader
		title="Blog"
		description="Write posts in Markdown. Published posts live at /u/{handle}/blog — Pro and self-host only."
	>
		{#snippet actions()}
			{#if canBlog}
				<Button disabled={creating} on:click={newPost}
					>{creating ? 'Creating…' : 'New post'}</Button
				>
			{/if}
		{/snippet}
	</PageHeader>

	{#if showUpgrade}
		<UpgradePrompt
			title="Unlock blogging"
			message={upgradeMessage}
			billingAvailable={planInfo?.billing_available ?? false}
			on:upgraded={() => {
				showUpgrade = false;
				getPlan()
					.then((p) => (planInfo = p))
					.catch(() => {});
			}}
		/>
	{/if}

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if !canBlog && posts.length === 0}
		<Card variant="panel">
			<p>Blog writing is included with Pro (and always on for self-host).</p>
			<Button on:click={() => (showUpgrade = true)}>Upgrade to Pro</Button>
		</Card>
	{:else if posts.length === 0}
		<Card variant="panel">
			<p class="muted">No posts yet. Create a draft and publish when ready.</p>
			<p class="empty-hint">
				Markdown basics: <code>## headings</code>, <code>**bold**</code>,
				<code>[links](https://…)</code>, lists with <code>-</code>, and fenced
				<code>```code```</code> blocks.
			</p>
			<Button disabled={creating} on:click={newPost}>{creating ? 'Creating…' : 'New post'}</Button>
		</Card>
	{:else}
		<ul class="list">
			{#each posts as post (post.id)}
				<li class="item">
					<div class="main">
						<div class="title-row">
							<strong>{post.title || 'Untitled'}</strong>
							<span
								class="badge"
								class:published={post.status === 'published'}
								class:draft={post.status === 'draft'}
							>
								{post.status === 'published' ? 'Published' : 'Draft'}
							</span>
						</div>
						<span class="meta">
							{#if post.published_at}
								{post.published_at.slice(0, 10)}
							{:else}
								Not published
							{/if}
						</span>
					</div>
					<div class="actions">
						{#if post.status === 'published' && handle}
							<a class="live" href={publicUrl(post.slug)} target="_blank" rel="noopener noreferrer">
								View live
							</a>
						{/if}
						<a class="action-link" href={`/blog/${post.id}`}>Edit</a>
						<button
							type="button"
							class="action-btn"
							disabled={busyId === post.id || (!canBlog && post.status === 'draft')}
							onclick={() => togglePublish(post)}
						>
							{post.status === 'published' ? 'Unpublish' : 'Publish'}
						</button>
						<button
							type="button"
							class="action-btn danger"
							disabled={busyId === post.id}
							onclick={() => remove(post)}
						>
							Delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
		{#if !canBlog}
			<p class="hint muted">You can view existing drafts, but creating or publishing needs Pro.</p>
		{/if}
	{/if}
</div>

<style>
	.blog-list-page {
		width: 100%;
		max-width: none;
	}
	.muted {
		color: var(--color-muted);
	}
	.empty-hint {
		margin: var(--space-3) 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.5;
	}
	.empty-hint code {
		background: var(--color-primary-light);
		color: var(--color-primary);
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		overflow: hidden;
	}
	.item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
		border-top: 1px solid var(--color-border);
		padding: var(--space-3) var(--space-4);
	}
	.item:first-child {
		border-top: none;
	}
	.main {
		min-width: 0;
		flex: 1 1 12rem;
	}
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.title-row strong {
		font-size: 0.875rem;
	}
	.badge {
		display: inline-block;
		font-size: 0.625rem;
		font-weight: 600;
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-muted);
		text-transform: capitalize;
	}
	.badge.draft {
		color: var(--color-warning-text);
		background: var(--color-warning-bg);
		border-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-border));
	}
	.badge.published {
		color: var(--color-success-text);
		background: var(--color-success-bg);
		border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
	}
	.meta {
		display: block;
		margin-top: 0.1rem;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		flex-shrink: 0;
	}
	.live,
	.action-link,
	.action-btn {
		flex-shrink: 0;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-primary);
		text-decoration: none;
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		cursor: pointer;
	}
	.live:hover,
	.action-link:hover,
	.action-btn:hover:not(:disabled) {
		text-decoration: underline;
	}
	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.action-btn.danger {
		color: var(--color-error);
	}
	.hint {
		margin-top: var(--space-3);
		font-size: 0.8125rem;
	}
</style>
