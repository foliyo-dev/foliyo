<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import {
		listLanguages,
		createLanguage,
		updateLanguage,
		deleteLanguage,
		languageProficiencies,
		type Language,
		type LanguageProficiency
	} from '$lib/api/languages';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let shell: EditorWithPreview;
	let items: Language[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;

	let name = '';
	let proficiency: LanguageProficiency = 'conversational';
	let sortOrder = '0';

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listLanguages();
		} catch {
			items = [];
			showToast('Failed to load languages', 'error');
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		name = '';
		proficiency = 'conversational';
		sortOrder = String(items.length);
		editingId = null;
	}

	function payload(): Partial<Language> {
		return {
			name: name.trim(),
			proficiency,
			sort_order: Number(sortOrder) || 0
		};
	}

	async function add() {
		if (!name.trim()) {
			showToast('Name is required', 'error');
			return;
		}
		saving = true;
		try {
			items = await createLanguage(payload());
			showToast('Language added', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to add language', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(item: Language) {
		editingId = item.id;
		name = item.name;
		proficiency = item.proficiency;
		sortOrder = String(item.sort_order);
		shell?.scrollToForm();
	}

	async function saveEdit() {
		if (!editingId) return;
		saving = true;
		try {
			await updateLanguage(editingId, payload());
			await load();
			showToast('Language updated', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to update language', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		const item = items.find((l) => l.id === id);
		if (!(await confirmDelete(item?.name?.trim() || 'this language'))) return;
		try {
			await deleteLanguage(id);
			items = items.filter((l) => l.id !== id);
			if (editingId === id) resetForm();
			showToast('Language deleted', 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to delete language', 'error');
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={editingId ? 'Edit language' : 'Languages'}
		description="Spoken and written languages for your public profile and resume."
	/>

	<Card>
	<h2 class="section-title">{editingId ? 'Edit language' : 'Add language'}</h2>
	<div class="fields">
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
	</div>
	<div class="form-actions">
		{#if editingId}
			<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
			<Button variant="ghost" on:click={resetForm}>Cancel</Button>
		{:else}
			<Button disabled={saving} on:click={add}>{saving ? 'Adding…' : 'Add language'}</Button>
		{/if}
	</div>
</Card>

{#if loading}
	<p class="muted">Loading…</p>
{:else if items.length === 0}
	<p class="muted empty">No languages yet.</p>
{:else}
	<ul class="list">
		{#each items as item (item.id)}
			<li>
				<Card>
					<div class="item-row">
						<div>
							<strong>{item.name}</strong>
							<span class="meta">{item.proficiency}</span>
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
	select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
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
	.meta {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-muted);
		margin-top: 0.25rem;
		text-transform: capitalize;
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
	}
</style>
