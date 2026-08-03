<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import {
		listProjects,
		createProject,
		updateProject,
		deleteProject,
		type Project
	} from '$lib/api/projects';
	import { showToast } from '$lib/stores/toast';

	let shell: EditorWithPreview;
	let items: Project[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;

	let title = '';
	let description = '';
	let url = '';
	let repoUrl = '';
	let articleUrl = '';
	let imageUrl = '';
	let tagsInput = '';
	let featured = false;
	let sortOrder = '0';

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listProjects();
		} catch {
			items = [];
			showToast('Failed to load projects', 'error');
		} finally {
			loading = false;
		}
	}

	function tagsToJson(input: string): string {
		const tags = input
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		return JSON.stringify(tags);
	}

	function tagsFromJson(json: string): string {
		try {
			const arr = JSON.parse(json);
			return Array.isArray(arr) ? arr.join(', ') : '';
		} catch {
			return '';
		}
	}

	function resetForm() {
		title = '';
		description = '';
		url = '';
		repoUrl = '';
		articleUrl = '';
		imageUrl = '';
		tagsInput = '';
		featured = false;
		sortOrder = String(items.length);
		editingId = null;
	}

	function payload(): Partial<Project> {
		return {
			title: title.trim(),
			description,
			url,
			repo_url: repoUrl,
			article_url: articleUrl,
			image_url: imageUrl,
			tags: tagsToJson(tagsInput),
			featured: featured ? 1 : 0,
			sort_order: Number(sortOrder) || 0
		};
	}

	async function addProject() {
		if (!title.trim()) {
			showToast('Project title is required', 'error');
			return;
		}
		saving = true;
		try {
			items = await createProject(payload());
			showToast('Project added', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to add project', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(project: Project) {
		editingId = project.id;
		title = project.title;
		description = project.description;
		url = project.url;
		repoUrl = project.repo_url;
		articleUrl = project.article_url ?? '';
		imageUrl = project.image_url;
		tagsInput = tagsFromJson(project.tags);
		featured = project.featured === 1;
		sortOrder = String(project.sort_order);
	}

	async function saveEdit() {
		if (!editingId || !title.trim()) return;
		saving = true;
		try {
			await updateProject(editingId, payload());
			await load();
			showToast('Project updated', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to update project', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		try {
			await deleteProject(id);
			items = items.filter((p) => p.id !== id);
			if (editingId === id) resetForm();
			showToast('Project deleted', 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to delete project', 'error');
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title="Projects"
		description="Showcase your work — demos, repos, and write-ups (Foliyo or any external blog)."
	/>

	<Card>
		<h2 class="section-title">{editingId ? 'Edit project' : 'Add project'}</h2>
		<div class="fields">
			<Input label="Title" bind:value={title} placeholder="My awesome app" />
			<Textarea label="Description" bind:value={description} rows={4} />
			<div class="row">
				<Input label="Live URL" bind:value={url} placeholder="https://…" />
				<Input label="Repo URL" bind:value={repoUrl} placeholder="https://github.com/…" />
			</div>
			<Input
				label="Write-up / article URL"
				bind:value={articleUrl}
				placeholder="https://dev.to/… or Medium, docs, future Foliyo post…"
			/>
			<Input label="Image URL" bind:value={imageUrl} placeholder="https://…" />
			<Input label="Tags (comma-separated)" bind:value={tagsInput} placeholder="react, node" />
			<div class="row">
				<Input label="Sort order" bind:value={sortOrder} />
				<label class="checkbox">
					<input type="checkbox" bind:checked={featured} />
					Featured project
				</label>
			</div>
		</div>
		<div class="form-actions">
			{#if editingId}
				<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
				<Button variant="ghost" on:click={resetForm}>Cancel</Button>
			{:else}
				<Button disabled={saving} on:click={addProject}>{saving ? 'Adding…' : 'Add project'}</Button>
			{/if}
		</div>
	</Card>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if items.length === 0}
		<p class="muted empty">No projects yet — add your first one above.</p>
	{:else}
		<ul class="list">
			{#each items as project (project.id)}
				<li>
					<Card>
						<div class="item-row">
							<div>
								<h3>
									{project.title}
									{#if project.featured}<span class="tag">featured</span>{/if}
								</h3>
								{#if project.description}
									<p class="desc">{project.description}</p>
								{/if}
								<p class="meta">
									{#if project.url}<a href={project.url} target="_blank" rel="noreferrer">Live</a>{/if}
									{#if project.repo_url}
										{#if project.url} · {/if}
										<a href={project.repo_url} target="_blank" rel="noreferrer">Repo</a>
									{/if}
									{#if project.article_url}
										{#if project.url || project.repo_url} · {/if}
										<a href={project.article_url} target="_blank" rel="noreferrer">Write-up</a>
									{/if}
									{#if tagsFromJson(project.tags)}
										 · {tagsFromJson(project.tags)}
									{/if}
								</p>
							</div>
							<div class="row-actions">
								<Button variant="ghost" on:click={() => startEdit(project)}>Edit</Button>
								<Button variant="ghost" on:click={() => remove(project.id)}>Delete</Button>
							</div>
						</div>
					</Card>
				</li>
			{/each}
		</ul>
	{/if}
</EditorWithPreview>

<style>
	.section-title {
		margin: 0 0 1rem;
		font-size: 1rem;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 1rem;
		align-items: end;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		padding-bottom: 0.5rem;
	}
	.form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.muted {
		color: var(--color-muted);
	}
	.empty {
		margin-top: 1rem;
	}
	.list {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.item-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h3 {
		margin: 0;
		font-size: 1.0625rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.tag {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		background: var(--color-primary-light);
		color: var(--color-primary);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
	}
	.desc {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
		color: var(--color-text);
	}
	.meta {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
	}
</style>
