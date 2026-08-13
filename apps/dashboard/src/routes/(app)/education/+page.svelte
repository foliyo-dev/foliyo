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
	import { createCrudList } from '$lib/utils/crudList';
	import { skillsToJson, skillsFromJson } from '$lib/utils/skills';
	import {
		listEducation,
		createEducation,
		updateEducation,
		deleteEducation,
		type Education
	} from '$lib/api/education';

	let shell: EditorWithPreview;
	let present = false;

	let institution = '';
	let degree = '';
	let field = '';
	let startDate = '';
	let endDate = '';
	let description = '';
	let skillsInput = '';
	let sortOrder = '0';

	const crud = createCrudList<Education>(
		{ list: listEducation, create: createEducation, update: updateEducation, remove: deleteEducation },
		{
			getPayload: () => ({
				institution: institution.trim(),
				degree,
				field,
				start_date: startDate,
				end_date: present ? null : endDate || null,
				description,
				skills_developed: skillsToJson(skillsInput),
				sort_order: Number(sortOrder) || 0
			}),
			applyToForm: (item) => {
				institution = item.institution;
				degree = item.degree;
				field = item.field;
				startDate = item.start_date;
				endDate = item.end_date ?? '';
				present = !item.end_date;
				description = item.description;
				skillsInput = skillsFromJson(item.skills_developed ?? '[]');
				sortOrder = String(item.sort_order);
			},
			resetFields: () => {
				institution = '';
				degree = '';
				field = '';
				startDate = '';
				endDate = '';
				description = '';
				skillsInput = '';
				present = false;
				sortOrder = String($items.length);
			},
			getDeleteLabel: (item) => item.institution?.trim() || 'this school',
			validate: () => (!institution.trim() || !startDate ? 'Institution and start date are required' : null),
			onChange: () => shell?.refreshPreview(),
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'education', entity: 'Education' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	onMount(crud.load);
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit education' : 'Education'}
		description="Degrees and schools — add skills developed to feed your skill library."
	/>

	{#if !$formOpen}
		<div class="toolbar">
			<Button on:click={crud.openAdd}>+ Add education</Button>
		</div>
	{/if}

	{#if $formOpen}
		<ContentFormCard title={$editingId ? 'Edit education' : 'Add education'}>
			<svelte:fragment slot="fields">
				<Input label="Institution" bind:value={institution} placeholder="University of Mumbai" />
				<div class="row">
					<Input label="Degree" bind:value={degree} placeholder="B.Tech" />
					<Input label="Field" bind:value={field} placeholder="Computer Science" />
				</div>
				<div class="row">
					<Input label="Start date" bind:value={startDate} placeholder="2018" />
					<Input label="End date" bind:value={endDate} placeholder="2022" disabled={present} />
				</div>
				<label class="checkbox">
					<input type="checkbox" bind:checked={present} />
					Currently studying here
				</label>
				<Textarea label="Description" bind:value={description} rows={3} />
				<Input label="Skills developed (comma-separated)" bind:value={skillsInput} placeholder="Python, Data structures" />
				<Input label="Sort order" bind:value={sortOrder} />
			</svelte:fragment>
			<svelte:fragment slot="actions">
				{#if $editingId}
					<Button disabled={$saving} on:click={crud.saveEdit}>{$saving ? 'Saving…' : 'Save changes'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{:else}
					<Button disabled={$saving} on:click={crud.add}>{$saving ? 'Adding…' : 'Add education'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{/if}
			</svelte:fragment>
		</ContentFormCard>
	{/if}

	<ContentList loading={$loading} empty={$items.length === 0} emptyMessage="No education entries yet.">
		{#each $items as item (item.id)}
			<ContentListItem onEdit={() => crud.startEdit(item)} onRemove={() => crud.remove(item)}>
				<strong>{item.institution}</strong>
				{#if item.degree || item.field}
					<span class="meta">{item.degree}{#if item.degree && item.field}, {/if}{item.field}</span>
				{/if}
				<span class="meta">{item.start_date} – {item.end_date ?? 'Present'}</span>
				{#if item.description}
					<p class="desc">{item.description}</p>
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
