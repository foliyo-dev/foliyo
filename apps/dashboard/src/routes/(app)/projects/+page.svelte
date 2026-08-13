<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import ContentFormCard from '$lib/components/content/ContentFormCard.svelte';
	import ContentList from '$lib/components/content/ContentList.svelte';
	import ContentListItem from '$lib/components/content/ContentListItem.svelte';
	import AiRewriteAssist from '$lib/components/AiRewriteAssist.svelte';
	import { createCrudList } from '$lib/utils/crudList';
	import { skillsToJson, skillsFromJson } from '$lib/utils/skills';
	import {
		listProjects,
		createProject,
		updateProject,
		deleteProject,
		uploadProjectImage,
		type Project
	} from '$lib/api/projects';
	import { ApiError } from '$lib/api/client';
	import { showToast } from '$lib/stores/toast';

	let shell: EditorWithPreview;

	let title = '';
	let description = '';
	let url = '';
	let repoUrl = '';
	let articleUrl = '';
	let urlLabel = '';
	let repoUrlLabel = '';
	let articleUrlLabel = '';
	let imageUrl = '';
	let skillsInput = '';
	let featured = false;
	let sortOrder = '0';
	let uploading = false;

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

	const crud = createCrudList<Project>(
		{ list: listProjects, create: createProject, update: updateProject, remove: deleteProject },
		{
			getPayload: () => ({
				title: title.trim(),
				description,
				url,
				repo_url: repoUrl,
				article_url: articleUrl,
				url_label: urlLabel,
				repo_url_label: repoUrlLabel,
				article_url_label: articleUrlLabel,
				image_url: imageUrl,
				skills_developed: skillsToJson(skillsInput),
				featured: featured ? 1 : 0,
				sort_order: Number(sortOrder) || 0
			}),
			applyToForm: (item) => {
				title = item.title;
				description = item.description;
				url = item.url;
				repoUrl = item.repo_url;
				articleUrl = item.article_url ?? '';
				urlLabel = item.url_label ?? '';
				repoUrlLabel = item.repo_url_label ?? '';
				articleUrlLabel = item.article_url_label ?? '';
				imageUrl = item.image_url;
				skillsInput = skillsFromJson(item.skills_developed);
				featured = item.featured === 1;
				sortOrder = String(item.sort_order);
			},
			resetFields: () => {
				title = '';
				description = '';
				url = '';
				repoUrl = '';
				articleUrl = '';
				urlLabel = '';
				repoUrlLabel = '';
				articleUrlLabel = '';
				imageUrl = '';
				skillsInput = '';
				featured = false;
				sortOrder = String($items.length);
			},
			getDeleteLabel: (item) => item.title?.trim() || 'this project',
			validate: () => (!title.trim() ? 'Project title is required' : null),
			onChange: () => shell?.refreshPreview(),
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'projects', entity: 'Project' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	onMount(crud.load);

	async function onImageFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		uploading = true;
		try {
			const res = await uploadProjectImage(file);
			imageUrl = res.url;
			showToast('Image uploaded', 'success');
		} catch (err) {
			showToast(uploadErrorMessage(err), 'error');
		} finally {
			uploading = false;
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit project' : 'Projects'}
		description="Showcase your work — links and labels can be Live/Repo, Series/Prints, Paper/Read, or whatever the folio needs."
	/>

	{#if !$formOpen}
		<div class="toolbar">
			<Button on:click={crud.openAdd}>+ Add project</Button>
		</div>
	{/if}

	{#if $formOpen}
		<ContentFormCard title={$editingId ? 'Edit project' : 'Add project'}>
			<svelte:fragment slot="fields">
				<Input label="Title" bind:value={title} placeholder="My awesome app" />
				<Textarea label="Description" bind:value={description} rows={4} />
				<AiRewriteAssist bind:value={description} disabled={$saving} />
				<div class="row">
					<Input label="URL" bind:value={url} placeholder="https://…" />
					<Input label="URL label" bind:value={urlLabel} placeholder="Live, Series, Paper…" />
				</div>
				<div class="row">
					<Input label="Second URL" bind:value={repoUrl} placeholder="https://github.com/…" />
					<Input label="Second URL label" bind:value={repoUrlLabel} placeholder="Repo, Prints, Data…" />
				</div>
				<div class="row">
					<Input
						label="Write-up URL"
						bind:value={articleUrl}
						placeholder="https://dev.to/… or Medium, docs…"
					/>
					<Input label="Write-up label" bind:value={articleUrlLabel} placeholder="View write-up, Read, Talk…" />
				</div>
				<div class="row">
					<Input label="Image URL" bind:value={imageUrl} placeholder="https://… or upload" />
					<label class="file-field">
						<span class="file-label">Upload image</span>
						<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} on:change={onImageFile} />
						{#if uploading}<span class="muted">Uploading…</span>{/if}
					</label>
				</div>
				<Input label="Skills developed (comma-separated)" bind:value={skillsInput} placeholder="React, Node.js" />
				<div class="row">
					<Input label="Sort order" bind:value={sortOrder} />
					<label class="checkbox">
						<input type="checkbox" bind:checked={featured} />
						Featured project
					</label>
				</div>
			</svelte:fragment>
			<svelte:fragment slot="actions">
				{#if $editingId}
					<Button disabled={$saving} on:click={crud.saveEdit}>{$saving ? 'Saving…' : 'Save changes'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{:else}
					<Button disabled={$saving} on:click={crud.add}>{$saving ? 'Adding…' : 'Add project'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{/if}
			</svelte:fragment>
		</ContentFormCard>
	{/if}

	<ContentList loading={$loading} empty={$items.length === 0} emptyMessage="No projects yet — add your first one above.">
		{#each $items as project (project.id)}
			<ContentListItem onEdit={() => crud.startEdit(project)} onRemove={() => crud.remove(project)}>
				<div class="project-row">
					{#if project.image_url}
						<img
							class="thumb"
							src={project.image_url}
							alt=""
							loading="lazy"
							on:error={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
						/>
					{/if}
					<div class="project-body">
						<h3>
							{project.title}
							{#if project.featured}<span class="tag">featured</span>{/if}
						</h3>
						{#if project.description}
							<p class="desc">{project.description}</p>
						{/if}
						<p class="meta">
							{#if project.url}<a href={project.url} target="_blank" rel="noreferrer">{project.url_label || 'Live'}</a>{/if}
							{#if project.repo_url}
								{#if project.url} · {/if}
								<a href={project.repo_url} target="_blank" rel="noreferrer">{project.repo_url_label || 'Repo'}</a>
							{/if}
							{#if project.article_url}
								{#if project.url || project.repo_url} · {/if}
								<a href={project.article_url} target="_blank" rel="noreferrer">{project.article_url_label || 'Write-up'}</a>
							{/if}
							{#if skillsFromJson(project.skills_developed)}
								 · {skillsFromJson(project.skills_developed)}
							{/if}
						</p>
					</div>
				</div>
			</ContentListItem>
		{/each}
	</ContentList>
</EditorWithPreview>

<style>
	.toolbar {
		margin-bottom: 1rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 1rem;
		align-items: end;
	}
	.project-row {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		min-width: 0;
	}
	.thumb {
		width: 4.5rem;
		height: 4.5rem;
		object-fit: cover;
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		flex-shrink: 0;
	}
	.project-body {
		min-width: 0;
		flex: 1;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		padding-bottom: 0.5rem;
	}
	.file-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
	}
	.file-label {
		font-weight: 500;
	}
	.muted {
		color: var(--color-muted);
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
</style>
