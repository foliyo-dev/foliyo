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
		listExperience,
		createExperience,
		updateExperience,
		deleteExperience,
		reorderExperience,
		listDeletedExperience,
		restoreExperience,
		purgeExperience,
		type Experience
	} from '$lib/api/experience';

	let shell: EditorWithPreview;
	let trash: RecentlyDeleted;
	let present = false;

	let company = '';
	let role = '';
	let location = '';
	let startDate = '';
	let endDate = '';
	let description = '';
	let articleUrl = '';
	let articleUrlLabel = '';
	let skillsInput = '';
	let sortOrder = '0';

	const crud = createCrudList<Experience>(
		{ list: listExperience, create: createExperience, update: updateExperience, remove: deleteExperience, reorder: reorderExperience },
		{
			getPayload: () => ({
				company: company.trim(),
				role: role.trim(),
				location,
				start_date: startDate,
				end_date: present ? null : endDate || null,
				description,
				article_url: articleUrl,
				article_url_label: articleUrlLabel,
				skills_developed: skillsToJson(skillsInput),
				sort_order: Number(sortOrder) || 0
			}),
			applyToForm: (item) => {
				company = item.company;
				role = item.role;
				location = item.location;
				startDate = item.start_date;
				endDate = item.end_date ?? '';
				present = !item.end_date;
				description = item.description;
				articleUrl = item.article_url ?? '';
				articleUrlLabel = item.article_url_label ?? '';
				skillsInput = skillsFromJson(item.skills_developed ?? '[]');
				sortOrder = String(item.sort_order);
			},
			resetFields: () => {
				company = '';
				role = '';
				location = '';
				startDate = '';
				endDate = '';
				description = '';
				articleUrl = '';
				articleUrlLabel = '';
				skillsInput = '';
				present = false;
				sortOrder = String($items.length);
			},
			getDeleteLabel: (item) => item.role?.trim() || item.company?.trim() || 'this role',
			validate: () =>
				!company.trim() || !role.trim() || !startDate
					? 'Company, role, and start date are required'
					: null,
			onChange: async () => {
				await shell?.refreshPreview();
				await trash?.reload();
			},
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'experience', entity: 'Experience' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	onMount(crud.load);
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit role' : 'Experience'}
		description="Work history — list order is how they appear on folios and resumes. Add skills developed so Foliyo can suggest skills for your library."
	/>
	<RecentlyDeleted
		bind:this={trash}
		listDeleted={listDeletedExperience}
		restore={restoreExperience}
		purge={purgeExperience}
		getLabel={(e) => {
			const x = e as Experience;
			return [x.role, x.company].filter(Boolean).join(' @ ') || 'Untitled experience';
		}}
		entityLabel="Experience"
		onRestored={async () => {
			await crud.load();
			await shell?.refreshPreview();
		}}
	/>

	{#if !$formOpen}
		<div class="toolbar">
			<Button on:click={crud.openAdd}>+ Add experience</Button>
		</div>
	{/if}

	{#if $formOpen}
		<ContentFormCard title={$editingId ? 'Edit role' : 'Add role'}>
			<svelte:fragment slot="fields">
				<div class="row">
					<Input label="Company" bind:value={company} placeholder="Acme Inc." />
					<Input label="Role" bind:value={role} placeholder="Software Engineer" />
				</div>
				<Input label="Location" bind:value={location} placeholder="Remote" />
				<div class="row">
					<Input label="Start date" bind:value={startDate} placeholder="2022-01" />
					<Input label="End date" bind:value={endDate} placeholder="2024-06" disabled={present} />
				</div>
				<label class="checkbox">
					<input type="checkbox" bind:checked={present} />
					Currently working here
				</label>
				<Textarea label="Description" bind:value={description} rows={4} />
				<AiRewriteAssist bind:value={description} disabled={$saving} />
				<Input label="Skills developed (comma-separated)" bind:value={skillsInput} placeholder="Node.js, PostgreSQL" />
				<Input
					label="Case study / write-up URL"
					bind:value={articleUrl}
					placeholder="https://… (external blog or future Foliyo post)"
				/>
				<Input label="Link label" bind:value={articleUrlLabel} placeholder="View write-up, Syllabus, Talk…" />
			</svelte:fragment>
			<svelte:fragment slot="actions">
				{#if $editingId}
					<Button disabled={$saving} on:click={crud.saveEdit}>{$saving ? 'Saving…' : 'Save changes'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{:else}
					<Button disabled={$saving} on:click={crud.add}>{$saving ? 'Adding…' : 'Add experience'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{/if}
			</svelte:fragment>
		</ContentFormCard>
	{/if}

	<ContentList loading={$loading} empty={$items.length === 0} emptyMessage="No experience entries yet.">
		{#each $items as item, i (item.id)}
			<ContentListItem
				onEdit={() => crud.startEdit(item)}
				onRemove={() => crud.remove(item)}
				onMoveUp={$items.length > 1 && i > 0 ? () => crud.move(item.id, -1) : undefined}
				onMoveDown={$items.length > 1 && i < $items.length - 1 ? () => crud.move(item.id, 1) : undefined}
			>
				<strong>{item.role}</strong> at {item.company}
				<span class="meta">
					{item.start_date} – {item.end_date ?? 'Present'}
					{#if item.location} · {item.location}{/if}
				</span>
				{#if item.description}
					<p class="desc">{item.description}</p>
				{/if}
				{#if item.article_url}
					<p class="meta">
						<a href={item.article_url} target="_blank" rel="noreferrer">View write-up →</a>
					</p>
				{/if}
				{#if skillsFromJson(item.skills_developed ?? '[]')}
					<p class="meta">Skills: {skillsFromJson(item.skills_developed ?? '[]')}</p>
				{/if}
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
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
</style>
