<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import {
		listEducation,
		createEducation,
		updateEducation,
		deleteEducation,
		type Education
	} from '$lib/api/education';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let shell: EditorWithPreview;
	let items: Education[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;
	let present = false;

	let institution = '';
	let degree = '';
	let field = '';
	let startDate = '';
	let endDate = '';
	let description = '';
	let skillsInput = '';
	let sortOrder = '0';

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listEducation();
		} catch {
			items = [];
			showToast('Failed to load education', 'error');
		} finally {
			loading = false;
		}
	}

	function skillsToJson(input: string): string {
		const skills = input
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		return JSON.stringify(skills);
	}

	function skillsFromJson(json: string): string {
		try {
			const arr = JSON.parse(json || '[]') as string[];
			return Array.isArray(arr) ? arr.join(', ') : '';
		} catch {
			return '';
		}
	}

	function resetForm() {
		institution = '';
		degree = '';
		field = '';
		startDate = '';
		endDate = '';
		description = '';
		skillsInput = '';
		present = false;
		sortOrder = String(items.length);
		editingId = null;
	}

	function payload(): Partial<Education> {
		return {
			institution: institution.trim(),
			degree,
			field,
			start_date: startDate,
			end_date: present ? null : endDate || null,
			description,
			skills_developed: skillsToJson(skillsInput),
			sort_order: Number(sortOrder) || 0
		};
	}

	async function add() {
		if (!institution.trim() || !startDate) {
			showToast('Institution and start date are required', 'error');
			return;
		}
		saving = true;
		try {
			items = await createEducation(payload());
			showToast('Education added', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to add education', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(item: Education) {
		editingId = item.id;
		institution = item.institution;
		degree = item.degree;
		field = item.field;
		startDate = item.start_date;
		endDate = item.end_date ?? '';
		present = !item.end_date;
		description = item.description;
		skillsInput = skillsFromJson(item.skills_developed ?? '[]');
		sortOrder = String(item.sort_order);
		shell?.scrollToForm();
	}

	async function saveEdit() {
		if (!editingId) return;
		saving = true;
		try {
			await updateEducation(editingId, payload());
			await load();
			showToast('Education updated', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to update education', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		const item = items.find((e) => e.id === id);
		if (!(await confirmDelete(item?.institution?.trim() || 'this school'))) return;
		try {
			await deleteEducation(id);
			items = items.filter((e) => e.id !== id);
			if (editingId === id) resetForm();
			showToast('Education deleted', 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to delete education', 'error');
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={editingId ? 'Edit education' : 'Education'}
		description="Degrees and schools — add skills developed to feed your skill library."
	/>

	<Card>
	<h2 class="section-title">{editingId ? 'Edit education' : 'Add education'}</h2>
	<div class="fields">
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
	</div>
	<div class="form-actions">
		{#if editingId}
			<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
			<Button variant="ghost" on:click={resetForm}>Cancel</Button>
		{:else}
			<Button disabled={saving} on:click={add}>{saving ? 'Adding…' : 'Add education'}</Button>
		{/if}
	</div>
</Card>

{#if loading}
	<p class="muted">Loading…</p>
{:else if items.length === 0}
	<p class="muted empty">No education entries yet.</p>
{:else}
	<ul class="list">
		{#each items as item (item.id)}
			<li>
				<Card>
					<div class="item-row">
						<div>
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
	}
	.desc {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
	}
</style>
