<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import SocialIcon from '$lib/components/social/SocialIcon.svelte';
	import {
		listSocialLinks,
		createSocialLink,
		updateSocialLink,
		deleteSocialLink,
		socialProviders,
		providerMeta,
		type SocialLink,
		type SocialProvider
	} from '$lib/api/social';
	import { showToast } from '$lib/stores/toast';

	let shell: EditorWithPreview;
	let items: SocialLink[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;

	let provider: SocialProvider = 'github';
	let label = '';
	let value = '';
	let sortOrder = '0';

	$: meta = providerMeta(provider);
	$: valueLabel = meta.usernameBased ? 'Username / handle' : 'URL';

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listSocialLinks();
		} catch {
			items = [];
			showToast('Failed to load social links', 'error');
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		provider = 'github';
		label = '';
		value = '';
		sortOrder = String(items.length);
		editingId = null;
	}

	function payload(): Partial<SocialLink> {
		return {
			provider,
			label: label.trim(),
			value: value.trim(),
			sort_order: Number(sortOrder) || 0
		};
	}

	async function add() {
		if (!value.trim()) {
			showToast(`${valueLabel} is required`, 'error');
			return;
		}
		saving = true;
		try {
			items = await createSocialLink(payload());
			showToast('Link added', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to add link', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(item: SocialLink) {
		editingId = item.id;
		provider = item.provider;
		label = item.label ?? '';
		value = item.value;
		sortOrder = String(item.sort_order);
		shell?.scrollToForm();
	}

	async function saveEdit() {
		if (!editingId || !value.trim()) return;
		saving = true;
		try {
			await updateSocialLink(editingId, payload());
			await load();
			showToast('Link updated', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to update link', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		try {
			await deleteSocialLink(id);
			items = items.filter((l) => l.id !== id);
			if (editingId === id) resetForm();
			showToast('Link deleted', 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to delete link', 'error');
		}
	}

	function itemTitle(item: SocialLink): string {
		if (item.label?.trim()) return item.label.trim();
		return providerMeta(item.provider).label;
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={editingId ? 'Edit link' : 'Social'}
		description="Profiles and sites shown on your public folio — pick a common network or add any URL."
	/>

	<Card>
		<h2 class="section-title">{editingId ? 'Edit link' : 'Add link'}</h2>
		<div class="fields">
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
		</div>
		<div class="form-actions">
			{#if editingId}
				<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
				<Button variant="ghost" on:click={resetForm}>Cancel</Button>
			{:else}
				<Button disabled={saving} on:click={add}>{saving ? 'Adding…' : 'Add link'}</Button>
			{/if}
		</div>
	</Card>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if items.length === 0}
		<p class="muted empty">No social links yet — add GitHub, LinkedIn, or a website.</p>
	{:else}
		<ul class="list">
			{#each items as item (item.id)}
				<li>
					<Card>
						<div class="item-row">
							<div class="item-main">
								<span class="social-chip">
									<SocialIcon provider={item.provider} size={16} />
									<span>{itemTitle(item)}</span>
								</span>
								<span class="meta">{item.value}</span>
							</div>
							<div class="row-actions">
								<Button variant="ghost" on:click={() => startEdit(item)}>Edit</Button>
								<Button variant="ghost" on:click={() => remove(item.id)}>Delete</Button>
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
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
	}
	.select,
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
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
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
	.meta {
		font-size: 0.8125rem;
		color: var(--color-muted);
		word-break: break-all;
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
	}
</style>
