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
	import SocialIcon from '$lib/components/social/SocialIcon.svelte';
	import { createCrudList } from '$lib/utils/crudList';
	import {
		listSocialLinks,
		createSocialLink,
		updateSocialLink,
		deleteSocialLink,
		listDeletedSocialLinks,
		restoreSocialLink,
		purgeSocialLink,
		socialProviders,
		providerMeta,
		type SocialLink,
		type SocialProvider
	} from '$lib/api/social';

	let shell: EditorWithPreview;
	let trash: RecentlyDeleted;

	let provider: SocialProvider = 'github';
	let label = '';
	let value = '';
	let sortOrder = '0';

	$: meta = providerMeta(provider);
	$: valueLabel = meta.usernameBased ? 'Username / handle' : 'URL';

	const crud = createCrudList<SocialLink>(
		{ list: listSocialLinks, create: createSocialLink, update: updateSocialLink, remove: deleteSocialLink },
		{
			getPayload: () => ({
				provider,
				label: label.trim(),
				value: value.trim(),
				sort_order: Number(sortOrder) || 0
			}),
			applyToForm: (item) => {
				provider = item.provider;
				label = item.label ?? '';
				value = item.value;
				sortOrder = String(item.sort_order);
			},
			resetFields: () => {
				provider = 'github';
				label = '';
				value = '';
				sortOrder = String($items.length);
			},
			getDeleteLabel: (item) => item.label?.trim() || item.value?.trim() || 'this link',
			validate: () => (!value.trim() ? `${valueLabel} is required` : null),
			canSave: () => value.trim().length > 0,
			onChange: async () => {
				await shell?.refreshPreview();
				await trash?.reload();
			},
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'social links', entity: 'Link' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	onMount(crud.load);

	function itemTitle(item: SocialLink): string {
		if (item.label?.trim()) return item.label.trim();
		return providerMeta(item.provider).label;
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit link' : 'Social'}
		description="Profiles and sites shown on your public folio — pick a common network or add any URL."
	/>
	<RecentlyDeleted
		bind:this={trash}
		listDeleted={listDeletedSocialLinks}
		restore={restoreSocialLink}
		purge={purgeSocialLink}
		getLabel={(s) => {
			const x = s as SocialLink;
			return x.label?.trim() || x.value?.trim() || x.provider || 'Untitled link';
		}}
		entityLabel="Social link"
		onRestored={async () => {
			await crud.load();
			await shell?.refreshPreview();
		}}
	/>

	{#if !$formOpen}
		<div class="toolbar">
			<Button on:click={crud.openAdd}>+ Add link</Button>
		</div>
	{/if}

	{#if $formOpen}
		<ContentFormCard title={$editingId ? 'Edit link' : 'Add link'}>
			<svelte:fragment slot="fields">
				<label class="field">
					<span class="label">Site</span>
					<div class="site-row">
						<span class="site-icon" aria-hidden="true">
							<SocialIcon provider={provider} size={18} />
						</span>
						<select bind:value={provider}>
							{#each socialProviders as p}
								<option value={p.id}>{p.label}</option>
							{/each}
						</select>
					</div>
				</label>
				<Input label={valueLabel} bind:value placeholder={meta.placeholder} />
				{#if provider === 'other'}
					<Input label="Display label" bind:value={label} placeholder="Portfolio, Discord, …" />
				{/if}
				<Input label="Sort order" bind:value={sortOrder} />
			</svelte:fragment>
			<svelte:fragment slot="actions">
				{#if $editingId}
					<Button disabled={$saving} on:click={crud.saveEdit}>{$saving ? 'Saving…' : 'Save changes'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{:else}
					<Button disabled={$saving} on:click={crud.add}>{$saving ? 'Adding…' : 'Add link'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{/if}
			</svelte:fragment>
		</ContentFormCard>
	{/if}

	<ContentList
		loading={$loading}
		empty={$items.length === 0}
		emptyMessage="No social links yet — add GitHub, LinkedIn, or a website."
	>
		{#each $items as item (item.id)}
			<ContentListItem align="center" onEdit={() => crud.startEdit(item)} onRemove={() => crud.remove(item)}>
				<div class="item-main">
					<span class="social-chip">
						<SocialIcon provider={item.provider} size={16} />
						<span>{itemTitle(item)}</span>
					</span>
					<span class="meta">{item.value}</span>
				</div>
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
		color: var(--color-text);
	}
	.site-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.site-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		background: var(--color-primary-light);
		color: var(--color-primary);
		flex-shrink: 0;
	}
	.site-row select {
		flex: 1;
		min-width: 0;
	}
	.item-main {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}
	.social-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1;
		color: var(--color-text);
		width: fit-content;
	}
	.social-chip :global(.icon) {
		color: var(--color-primary);
	}
	.item-main .meta {
		margin-top: 0;
		word-break: break-all;
	}
</style>
