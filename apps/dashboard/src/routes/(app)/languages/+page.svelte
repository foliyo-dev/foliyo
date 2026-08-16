<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import ContentFormCard from '$lib/components/content/ContentFormCard.svelte';
	import ContentList from '$lib/components/content/ContentList.svelte';
	import ContentListItem from '$lib/components/content/ContentListItem.svelte';
	import RecentlyDeleted from '$lib/components/content/RecentlyDeleted.svelte';
	import { createCrudList } from '$lib/utils/crudList';
	import {
		listLanguages,
		createLanguage,
		updateLanguage,
		deleteLanguage,
		listDeletedLanguages,
		restoreLanguage,
		purgeLanguage,
		languageProficiencies,
		type Language,
		type LanguageProficiency
	} from '$lib/api/languages';

	let shell: EditorWithPreview;
	let trash: RecentlyDeleted;

	let name = '';
	let proficiency: LanguageProficiency = 'conversational';
	let sortOrder = '0';

	const crud = createCrudList<Language>(
		{ list: listLanguages, create: createLanguage, update: updateLanguage, remove: deleteLanguage },
		{
			getPayload: () => ({
				name: name.trim(),
				proficiency,
				sort_order: Number(sortOrder) || 0
			}),
			applyToForm: (item) => {
				name = item.name;
				proficiency = item.proficiency;
				sortOrder = String(item.sort_order);
			},
			resetFields: () => {
				name = '';
				proficiency = 'conversational';
				sortOrder = String($items.length);
			},
			getDeleteLabel: (item) => item.name?.trim() || 'this language',
			validate: () => (!name.trim() ? 'Name is required' : null),
			onChange: async () => {
				await shell?.refreshPreview();
				await trash?.reload();
			},
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'languages', entity: 'Language' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	onMount(crud.load);
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit language' : 'Languages'}
		description="Spoken and written languages for your public profile and resume."
	/>
	<RecentlyDeleted
		bind:this={trash}
		listDeleted={listDeletedLanguages}
		restore={restoreLanguage}
		purge={purgeLanguage}
		getLabel={(l) => (l as Language).name?.trim() || 'Untitled language'}
		entityLabel="Language"
		onRestored={async () => {
			await crud.load();
			await shell?.refreshPreview();
		}}
	/>

	{#if !$formOpen}
		<div class="toolbar">
			<Button on:click={crud.openAdd}>+ Add language</Button>
		</div>
	{/if}

	{#if $formOpen}
		<ContentFormCard title={$editingId ? 'Edit language' : 'Add language'}>
			<svelte:fragment slot="fields">
				<Input label="Language" bind:value={name} placeholder="Hindi" />
				<label class="field">
					<span class="label">Proficiency</span>
					<select bind:value={proficiency}>
						{#each languageProficiencies as p}
							<option value={p}>{p}</option>
						{/each}
					</select>
				</label>
				<Input label="Sort order" bind:value={sortOrder} />
			</svelte:fragment>
			<svelte:fragment slot="actions">
				{#if $editingId}
					<Button disabled={$saving} on:click={crud.saveEdit}>{$saving ? 'Saving…' : 'Save changes'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{:else}
					<Button disabled={$saving} on:click={crud.add}>{$saving ? 'Adding…' : 'Add language'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{/if}
			</svelte:fragment>
		</ContentFormCard>
	{/if}

	<ContentList loading={$loading} empty={$items.length === 0} emptyMessage="No languages yet.">
		{#each $items as item (item.id)}
			<ContentListItem onEdit={() => crud.startEdit(item)} onRemove={() => crud.remove(item)}>
				<strong>{item.name}</strong>
				<span class="meta">{item.proficiency}</span>
			</ContentListItem>
		{/each}
	</ContentList>
</EditorWithPreview>

<style>
	.toolbar {
		margin-bottom: 1rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
	}
	select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}
	.meta {
		text-transform: capitalize;
	}
</style>
