<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		listSkills,
		createSkill,
		updateSkill,
		deleteSkill,
		type Skill
	} from '$lib/api/skills';
	import { showToast } from '$lib/stores/toast';

	const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

	let items: Skill[] = [];
	let loading = true;
	let adding = false;
	let editingId: string | null = null;

	let name = '';
	let level: (typeof levels)[number] = 'intermediate';
	let category = 'general';
	let sortOrder = '0';

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listSkills();
		} catch {
			items = [];
			showToast('Failed to load skills', 'error');
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		name = '';
		level = 'intermediate';
		category = 'general';
		sortOrder = String(items.length);
		editingId = null;
	}

	async function addSkill() {
		if (!name.trim()) {
			showToast('Skill name is required', 'error');
			return;
		}
		adding = true;
		try {
			items = await createSkill({
				name: name.trim(),
				level,
				category: category.trim() || 'general',
				sort_order: Number(sortOrder) || 0
			});
			showToast('Skill added', 'success');
			resetForm();
		} catch {
			showToast('Failed to add skill', 'error');
		} finally {
			adding = false;
		}
	}

	function startEdit(skill: Skill) {
		editingId = skill.id;
		name = skill.name;
		level = skill.level as (typeof levels)[number];
		category = skill.category;
		sortOrder = String(skill.sort_order);
	}

	async function saveEdit() {
		if (!editingId || !name.trim()) return;
		try {
			await updateSkill(editingId, {
				name: name.trim(),
				level,
				category: category.trim() || 'general',
				sort_order: Number(sortOrder) || 0
			});
			await load();
			showToast('Skill updated', 'success');
			resetForm();
		} catch {
			showToast('Failed to update skill', 'error');
		}
	}

	async function remove(id: string) {
		try {
			await deleteSkill(id);
			items = items.filter((s) => s.id !== id);
			if (editingId === id) resetForm();
			showToast('Skill deleted', 'success');
		} catch {
			showToast('Failed to delete skill', 'error');
		}
	}
</script>

<PageHeader title="Skills" description="Master list of skills — attach them to portfolios later." />

<Card>
	<h2 class="section-title">{editingId ? 'Edit skill' : 'Add skill'}</h2>
	<div class="form-grid">
		<Input label="Name" bind:value={name} placeholder="TypeScript" />
		<label class="field">
			<span class="label">Level</span>
			<select bind:value={level}>
				{#each levels as l}
					<option value={l}>{l}</option>
				{/each}
			</select>
		</label>
		<Input label="Category" bind:value={category} placeholder="frontend" />
		<Input label="Sort order" bind:value={sortOrder} placeholder="0" />
	</div>
	<div class="form-actions">
		{#if editingId}
			<Button on:click={saveEdit}>Save changes</Button>
			<Button variant="ghost" on:click={resetForm}>Cancel</Button>
		{:else}
			<Button disabled={adding} on:click={addSkill}>{adding ? 'Adding…' : 'Add skill'}</Button>
		{/if}
	</div>
</Card>

{#if loading}
	<p class="muted">Loading…</p>
{:else if items.length === 0}
	<p class="muted empty">No skills yet — add your first one above.</p>
{:else}
	<ul class="list">
		{#each items as skill (skill.id)}
			<li>
				<Card>
					<div class="row">
						<div>
							<strong>{skill.name}</strong>
							<span class="meta">{skill.level} · {skill.category} · order {skill.sort_order}</span>
						</div>
						<div class="row-actions">
							<Button variant="ghost" on:click={() => startEdit(skill)}>Edit</Button>
							<Button variant="ghost" on:click={() => remove(skill.id)}>Delete</Button>
						</div>
					</div>
				</Card>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.section-title {
		margin: 0 0 1rem;
		font-size: 1rem;
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
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
		color: var(--color-text);
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
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.meta {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-muted);
		margin-top: 0.25rem;
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
	}
</style>
