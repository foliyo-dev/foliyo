<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import SkillTagsInput from '$lib/components/ui/SkillTagsInput.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import ContentFormCard from '$lib/components/content/ContentFormCard.svelte';
	import ContentList from '$lib/components/content/ContentList.svelte';
	import ContentListItem from '$lib/components/content/ContentListItem.svelte';
	import RecentlyDeleted from '$lib/components/content/RecentlyDeleted.svelte';
	import AiRewriteAssist from '$lib/components/AiRewriteAssist.svelte';
	import { aiByok, aiConfigured, ensureAiUsage } from '$lib/stores/ai';
	import { createCrudList } from '$lib/utils/crudList';
	import { parseSkillsJson, skillsArrayToJson, skillsFromJson } from '$lib/utils/skills';
	import {
		listProjects,
		createProject,
		updateProject,
		deleteProject,
		reorderProjects,
		listDeletedProjects,
		restoreProject,
		purgeProject,
		type Project
	} from '$lib/api/projects';
	import ImageField from '$lib/components/media/ImageField.svelte';

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
	let skills: string[] = [];
	let featured = false;
	let startDate = '';
	let endDate = '';
	let ongoing = false;
	let sortOrder = '0';

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
				skills_developed: skillsArrayToJson(skills),
				featured: featured ? 1 : 0,
				start_date: startDate,
				end_date: ongoing ? null : endDate || null,
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
				skills = parseSkillsJson(item.skills_developed ?? '[]');
				featured = item.featured === 1;
				startDate = item.start_date ?? '';
				endDate = item.end_date ?? '';
				ongoing = !item.end_date && Boolean(item.start_date);
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
				skills = [];
				featured = false;
				startDate = '';
				endDate = '';
				ongoing = false;
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

	onMount(() => {
		void ensureAiUsage();
		return crud.load();
	});
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit project' : 'Projects'}
		description="Showcase your work — featured projects lead; dates power the build-log timeline on storytelling folios."
	>
		{#snippet actions()}
			{#if !$formOpen}
				<Button size="sm" on:click={crud.openAdd}>+ Add project</Button>
			{/if}
		{/snippet}
	</PageHeader>
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

	{#if $formOpen}
		<ContentFormCard title={$editingId ? 'Edit project' : 'Add project'}>
			<svelte:fragment slot="fields">
				<Input label="Title" bind:value={title} placeholder="My awesome app" />
				<Textarea label="Description" bind:value={description} rows={4} />
				<AiRewriteAssist
					bind:value={description}
					disabled={$saving}
					aiEnabled={$aiConfigured}
					byok={$aiByok}
				/>
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
				<ImageField label="Project image" bind:value={imageUrl} />
				<SkillTagsInput label="Skills developed" bind:value={skills} placeholder="Type a skill and press Enter" />
				<div class="row">
					<Input label="Start date" bind:value={startDate} placeholder="2024-01" />
					<Input label="End date" bind:value={endDate} placeholder="2025-06" disabled={ongoing} />
				</div>
				<label class="checkbox">
					<input type="checkbox" bind:checked={ongoing} />
					Ongoing / still active
				</label>
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
