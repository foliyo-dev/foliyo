<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import {
		listSkills,
		createSkill,
		updateSkill,
		deleteSkill,
		suggestSkillsFromLibrary,
		confirmSkill,
		dismissSkill,
		type Skill
	} from '$lib/api/skills';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
	const recencies = ['current', 'past'] as const;

	let shell: EditorWithPreview;
	let items: Skill[] = [];
	let loading = true;
	let adding = false;
	let suggesting = false;
	let editingId: string | null = null;

	let name = '';
	let level: (typeof levels)[number] = 'intermediate';
	let recency: (typeof recencies)[number] = 'current';
	let category = 'general';
	let sortOrder = '0';

	$: pending = items.filter((s) => s.status === 'pending');
	$: confirmed = items.filter((s) => s.status !== 'pending' && s.status !== 'dismissed');
	$: dismissed = items.filter((s) => s.status === 'dismissed');

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listSkills('all');
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
		recency = 'current';
		category = 'general';
		sortOrder = String(confirmed.length);
		editingId = null;
	}

	function seenOn(skill: Skill): string {
		if (skill.evidence?.length) return `Seen on ${skill.evidence.join(', ')}`;
		return '';
	}

	function suggestHint(skill: Skill): string {
		const bits: string[] = [];
		if (skill.suggested_level) bits.push(`suggested ${skill.suggested_level}`);
		if (skill.suggested_recency) bits.push(skill.suggested_recency);
		if (skill.suggested_years != null) bits.push(`~${skill.suggested_years}y`);
		return bits.length ? bits.join(' · ') : '';
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
				recency,
				category: category.trim() || 'general',
				sort_order: Number(sortOrder) || 0
			});
			showToast('Skill added', 'success');
			resetForm();
			await shell?.refreshPreview();
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
		recency = (skill.recency as (typeof recencies)[number]) || 'current';
		category = skill.category;
		sortOrder = String(skill.sort_order);
		shell?.scrollToForm();
	}

	async function saveEdit() {
		if (!editingId || !name.trim()) return;
		try {
			await updateSkill(editingId, {
				name: name.trim(),
				level,
				recency,
				category: category.trim() || 'general',
				sort_order: Number(sortOrder) || 0
			});
			await load();
			showToast('Skill updated', 'success');
			resetForm();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to update skill', 'error');
		}
	}

	async function remove(id: string) {
		const item = items.find((s) => s.id === id);
		if (!(await confirmDelete(item?.name?.trim() || 'this skill'))) return;
		try {
			await deleteSkill(id);
			items = items.filter((s) => s.id !== id);
			if (editingId === id) resetForm();
			showToast('Skill deleted', 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to delete skill', 'error');
		}
	}

	async function refreshSuggestions() {
		suggesting = true;
		try {
			const result = await suggestSkillsFromLibrary();
			await load();
			showToast(
				result.pending
					? `${result.pending} skill(s) awaiting review`
					: 'No new suggestions from library',
				'success'
			);
		} catch {
			showToast('Failed to suggest skills', 'error');
		} finally {
			suggesting = false;
		}
	}

	async function confirm(skill: Skill) {
		try {
			await confirmSkill(skill.id, {
				level: skill.suggested_level || skill.level,
				recency: skill.suggested_recency || skill.recency || 'current',
				category: skill.category
			});
			await load();
			showToast(`Confirmed ${skill.name}`, 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to confirm skill', 'error');
		}
	}

	async function dismiss(skill: Skill) {
		try {
			await dismissSkill(skill.id);
			await load();
			showToast(`Dismissed ${skill.name}`, 'success');
		} catch {
			showToast('Failed to dismiss skill', 'error');
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={editingId ? 'Edit skill' : 'Skills'}
		description="Add manually anytime, or confirm suggestions from skills developed on experience, projects, education, and certifications."
	/>

	<div class="toolbar">
		<Button variant="ghost" disabled={suggesting} on:click={refreshSuggestions}>
			{suggesting ? 'Refreshing…' : 'Suggest from library'}
		</Button>
	</div>

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
			<label class="field">
				<span class="label">Recency</span>
				<select bind:value={recency}>
					{#each recencies as r}
						<option value={r}>{r}</option>
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
	{:else}
		{#if pending.length > 0}
			<section class="block">
				<h2 class="section-title">Suggested</h2>
				<ul class="list">
					{#each pending as skill (skill.id)}
						<li>
							<Card>
								<div class="row">
									<div>
										<strong>{skill.name}</strong>
										<span class="meta">
											{#if suggestHint(skill)}{suggestHint(skill)}{:else}{skill.level}{/if}
											{#if seenOn(skill)} · {seenOn(skill)}{/if}
										</span>
									</div>
									<div class="row-actions">
										<Button on:click={() => confirm(skill)}>Confirm</Button>
										<Button variant="ghost" on:click={() => dismiss(skill)}>Dismiss</Button>
									</div>
								</div>
							</Card>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if confirmed.length === 0 && pending.length === 0}
			<p class="muted empty">No skills yet — add one above, or list skills developed on library items and suggest.</p>
		{:else if confirmed.length > 0}
			<section class="block">
				<h2 class="section-title">Your skills</h2>
				<ul class="list">
					{#each confirmed as skill (skill.id)}
						<li>
							<Card>
								<div class="row">
									<div>
										<strong>{skill.name}</strong>
										<span class="meta"
											>{skill.level} · {skill.recency ?? 'current'} · {skill.category}</span
										>
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
			</section>
		{/if}

		{#if dismissed.length > 0}
			<details class="block muted">
				<summary>Dismissed ({dismissed.length})</summary>
				<ul class="list">
					{#each dismissed as skill (skill.id)}
						<li>
							<Card>
								<div class="row">
									<div>
										<strong>{skill.name}</strong>
										<span class="meta">Won't re-suggest from library</span>
									</div>
									<div class="row-actions">
										<Button variant="ghost" on:click={() => confirm(skill)}>Restore</Button>
										<Button variant="ghost" on:click={() => remove(skill.id)}>Delete</Button>
									</div>
								</div>
							</Card>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</EditorWithPreview>

<style>
	.toolbar {
		margin-bottom: 1rem;
	}
	.block {
		margin-top: 1.25rem;
	}
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
		margin: 0;
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
	details summary {
		cursor: pointer;
		margin-bottom: 0.75rem;
	}
</style>
