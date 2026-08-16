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
	import { createCrudList } from '$lib/utils/crudList';
	import { skillsToJson, skillsFromJson } from '$lib/utils/skills';
	import {
		listCertifications,
		createCertification,
		updateCertification,
		deleteCertification,
		listDeletedCertifications,
		restoreCertification,
		purgeCertification,
		type Certification
	} from '$lib/api/certifications';

	let shell: EditorWithPreview;
	let trash: RecentlyDeleted;

	let name = '';
	let issuer = '';
	let credentialId = '';
	let credentialUrl = '';
	let issuedAt = '';
	let expiresAt = '';
	let noExpiry = true;
	let description = '';
	let skillsInput = '';
	let sortOrder = '0';

	const crud = createCrudList<Certification>(
		{
			list: listCertifications,
			create: createCertification,
			update: updateCertification,
			remove: deleteCertification
		},
		{
			getPayload: () => ({
				name: name.trim(),
				issuer,
				credential_id: credentialId,
				credential_url: credentialUrl,
				issued_at: issuedAt || null,
				expires_at: noExpiry ? null : expiresAt || null,
				description,
				skills_developed: skillsToJson(skillsInput),
				sort_order: Number(sortOrder) || 0
			}),
			applyToForm: (item) => {
				name = item.name;
				issuer = item.issuer;
				credentialId = item.credential_id;
				credentialUrl = item.credential_url;
				issuedAt = item.issued_at ?? '';
				expiresAt = item.expires_at ?? '';
				noExpiry = !item.expires_at;
				description = item.description;
				skillsInput = skillsFromJson(item.skills_developed ?? '[]');
				sortOrder = String(item.sort_order);
			},
			resetFields: () => {
				name = '';
				issuer = '';
				credentialId = '';
				credentialUrl = '';
				issuedAt = '';
				expiresAt = '';
				noExpiry = true;
				description = '';
				skillsInput = '';
				sortOrder = String($items.length);
			},
			getDeleteLabel: (item) => item.name?.trim() || 'this certification',
			validate: () => (!name.trim() ? 'Name is required' : null),
			onChange: async () => {
				await shell?.refreshPreview();
				await trash?.reload();
			},
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'certifications', entity: 'Certification' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	onMount(crud.load);
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit certification' : 'Certifications'}
		description="Credentials and licenses — add skills covered to feed your skill library."
	/>
	<RecentlyDeleted
		bind:this={trash}
		listDeleted={listDeletedCertifications}
		restore={restoreCertification}
		purge={purgeCertification}
		getLabel={(c) => (c as Certification).name?.trim() || 'Untitled certification'}
		entityLabel="Certification"
		onRestored={async () => {
			await crud.load();
			await shell?.refreshPreview();
		}}
	/>

	{#if !$formOpen}
		<div class="toolbar">
			<Button on:click={crud.openAdd}>+ Add certification</Button>
		</div>
	{/if}

	{#if $formOpen}
		<ContentFormCard title={$editingId ? 'Edit certification' : 'Add certification'}>
			<svelte:fragment slot="fields">
				<Input label="Name" bind:value={name} placeholder="AWS Solutions Architect Associate" />
				<Input label="Issuer" bind:value={issuer} placeholder="Amazon Web Services" />
				<div class="row">
					<Input label="Credential ID" bind:value={credentialId} placeholder="ABC-123" />
					<Input label="Credential URL" bind:value={credentialUrl} placeholder="https://…" />
				</div>
				<div class="row">
					<Input label="Issued" bind:value={issuedAt} placeholder="2024-06" />
					<Input label="Expires" bind:value={expiresAt} placeholder="2027-06" disabled={noExpiry} />
				</div>
				<label class="checkbox">
					<input type="checkbox" bind:checked={noExpiry} />
					Does not expire
				</label>
				<Textarea label="Description" bind:value={description} rows={3} />
				<Input label="Skills covered (comma-separated)" bind:value={skillsInput} placeholder="AWS, Cloud architecture" />
				<Input label="Sort order" bind:value={sortOrder} />
			</svelte:fragment>
			<svelte:fragment slot="actions">
				{#if $editingId}
					<Button disabled={$saving} on:click={crud.saveEdit}>{$saving ? 'Saving…' : 'Save changes'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{:else}
					<Button disabled={$saving} on:click={crud.add}>{$saving ? 'Adding…' : 'Add certification'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{/if}
			</svelte:fragment>
		</ContentFormCard>
	{/if}

	<ContentList loading={$loading} empty={$items.length === 0} emptyMessage="No certifications yet.">
		{#each $items as item (item.id)}
			<ContentListItem onEdit={() => crud.startEdit(item)} onRemove={() => crud.remove(item)}>
				<strong>{item.name}</strong>
				{#if item.issuer}
					<span class="meta">{item.issuer}</span>
				{/if}
				<span class="meta">
					{#if item.issued_at}Issued {item.issued_at}{/if}
					{#if item.expires_at}
						{#if item.issued_at} · {/if}Expires {item.expires_at}
					{:else if item.issued_at}
						 · No expiry
					{/if}
				</span>
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
