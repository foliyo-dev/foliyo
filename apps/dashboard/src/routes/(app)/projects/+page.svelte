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
	import RecentlyDeleted from '$lib/components/content/RecentlyDeleted.svelte';
	import AiRewriteAssist from '$lib/components/AiRewriteAssist.svelte';
	import { createCrudList } from '$lib/utils/crudList';
	import { skillsToJson, skillsFromJson } from '$lib/utils/skills';
	import {
		listProjects,
		createProject,
		updateProject,
		deleteProject,
		reorderProjects,
		listDeletedProjects,
		restoreProject,
		purgeProject,
		uploadProjectImage,
		type Project
	} from '$lib/api/projects';
	import { ApiError } from '$lib/api/client';
	import { showToast } from '$lib/stores/toast';
	import { mediaUrl } from '$lib/config';

	let shell: EditorWithPreview;
	let trash: RecentlyDeleted;

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
	let imageInput: HTMLInputElement | null = null;
	let pasteImageUrl = false;
	let dragging = false;
	let dragDepth = 0;

	$: previewSrc = mediaUrl(imageUrl);
	$: showImageUrlField = pasteImageUrl || /^https?:\/\//i.test(imageUrl.trim());

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
		{ list: listProjects, create: createProject, update: updateProject, remove: deleteProject, reorder: reorderProjects },
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
				pasteImageUrl = /^https?:\/\//i.test(item.image_url ?? '');
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
				pasteImageUrl = false;
				skillsInput = '';
				featured = false;
				sortOrder = String($items.length);
			},
			getDeleteLabel: (item) => item.title?.trim() || 'this project',
			validate: () => (!title.trim() ? 'Project title is required' : null),
			onChange: async () => {
				await shell?.refreshPreview();
				await trash?.reload();
			},
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'projects', entity: 'Project' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	onMount(crud.load);

	async function uploadFile(file: File) {
		uploading = true;
		try {
			const res = await uploadProjectImage(file);
			imageUrl = res.url;
			pasteImageUrl = false;
			showToast('Image uploaded', 'success');
		} catch (err) {
			showToast(uploadErrorMessage(err), 'error');
		} finally {
			uploading = false;
		}
	}

	async function onImageFile(e: Event) {
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
		imageUrl = '';
		pasteImageUrl = false;
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit project' : 'Projects'}
		description="Showcase your work — list order is how they appear on folios and resumes."
	/>
	<RecentlyDeleted
		bind:this={trash}
		listDeleted={listDeletedProjects}
		restore={restoreProject}
		purge={purgeProject}
		getLabel={(p) => (p as Project).title?.trim() || 'Untitled project'}
		entityLabel="Project"
		onRestored={async () => {
			await crud.load();
			await shell?.refreshPreview();
		}}
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
				<div class="image-field">
					<span class="image-label">Project image</span>
					<input
						bind:this={imageInput}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						hidden
						disabled={uploading}
						on:change={onImageFile}
					/>
					<div
						class="dropzone"
						class:filled={Boolean(previewSrc)}
						class:dragging
						class:busy={uploading}
						role="button"
						tabindex="0"
						aria-label={previewSrc ? 'Replace project image' : 'Upload project image'}
						on:click={() => !uploading && imageInput?.click()}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								if (!uploading) imageInput?.click();
							}
						}}
						on:dragenter={onDragEnter}
						on:dragover={onDragOver}
						on:dragleave={onDragLeave}
						on:drop={onDrop}
					>
						{#if previewSrc}
							<img class="dropzone-img" src={previewSrc} alt="" />
							<div class="dropzone-veil">
								<span class="dropzone-cta">{uploading ? 'Uploading…' : 'Drop to replace, or click'}</span>
							</div>
						{:else}
							<svg class="dropzone-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.6" />
								<circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
								<path d="M7 17l3.4-3.8a1.2 1.2 0 0 1 1.8 0L16 17h2l-4.2-5.2a1.6 1.6 0 0 0-2.5 0L7 17z" fill="currentColor" />
							</svg>
							<strong>{uploading ? 'Uploading…' : dragging ? 'Drop image' : 'Drop image here'}</strong>
							<span>or click to browse · JPEG, PNG, WebP · 3 MB max</span>
						{/if}
					</div>
					{#if previewSrc}
						<div class="dropzone-bar">
							<button type="button" class="chip" disabled={uploading} on:click|stopPropagation={() => imageInput?.click()}>
								Change
							</button>
							<button type="button" class="chip danger" disabled={uploading} on:click|stopPropagation={clearImage}>
								Remove
							</button>
						</div>
					{/if}
					{#if showImageUrlField}
						<Input label="Image URL" bind:value={imageUrl} placeholder="https://…" />
					{:else}
						<button type="button" class="url-toggle" on:click={() => (pasteImageUrl = true)}>
							Or paste an image URL
						</button>
					{/if}
				</div>
				<Input label="Skills developed (comma-separated)" bind:value={skillsInput} placeholder="React, Node.js" />
				<label class="checkbox">
					<input type="checkbox" bind:checked={featured} />
					Featured project
				</label>
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
		{#each $items as project, i (project.id)}
			<ContentListItem
				onEdit={() => crud.startEdit(project)}
				onRemove={() => crud.remove(project)}
				onMoveUp={$items.length > 1 && i > 0 ? () => crud.move(project.id, -1) : undefined}
				onMoveDown={$items.length > 1 && i < $items.length - 1 ? () => crud.move(project.id, 1) : undefined}
			>
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
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		padding-bottom: 0.5rem;
	}
	.image-field {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.image-label {
		font-size: 0.875rem;
		font-weight: 500;
	}
	.dropzone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 10.5rem;
		padding: 1.25rem;
		border: 1.5px dashed color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
		border-radius: calc(var(--radius) + 4px);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)), var(--color-surface));
		color: var(--color-muted);
		text-align: center;
		cursor: pointer;
		overflow: hidden;
		transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
	}
	.dropzone:hover,
	.dropzone:focus-visible {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 4px var(--color-primary-light);
		outline: none;
	}
	.dropzone.dragging {
		border-style: solid;
		border-color: var(--color-primary);
		background: var(--color-primary-light);
		transform: scale(1.01);
	}
	.dropzone.busy {
		pointer-events: none;
		opacity: 0.75;
	}
	.dropzone.filled {
		padding: 0;
		border-style: solid;
		border-color: var(--color-border);
		background: var(--color-bg);
	}
	.dropzone-icon {
		color: var(--color-primary);
		margin-bottom: 0.25rem;
	}
	.dropzone strong {
		color: var(--color-text);
		font-size: 0.9rem;
		font-weight: 600;
	}
	.dropzone span {
		font-size: 0.75rem;
	}
	.dropzone-img {
		display: block;
		width: 100%;
		height: 10.5rem;
		object-fit: cover;
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
		letter-spacing: 0.01em;
	}
	.dropzone-bar {
		display: flex;
		gap: 0.4rem;
	}
	.chip {
		padding: 0.28rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
		background: var(--color-primary-light);
	}
	.chip.danger:hover:not(:disabled) {
		border-color: color-mix(in srgb, #b91c1c 35%, var(--color-border));
		color: #b91c1c;
		background: #fef2f2;
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.url-toggle {
		align-self: flex-start;
		background: none;
		border: 0;
		padding: 0;
		color: var(--color-muted);
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.url-toggle:hover {
		color: var(--color-primary);
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
