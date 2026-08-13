<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import ContentListItem from '$lib/components/content/ContentListItem.svelte';
	import { createCrudList } from '$lib/utils/crudList';
	import {
		listSkills,
		createSkill,
		updateSkill,
		deleteSkill,
		confirmSkill,
		dismissSkill,
		type Skill
	} from '$lib/api/skills';
	import { showToast } from '$lib/stores/toast';

	const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
	const recencies = ['current', 'past'] as const;

	let shell: EditorWithPreview;

	let name = '';
	let level: (typeof levels)[number] = 'intermediate';
	let recency: (typeof recencies)[number] = 'current';
	let category = 'general';
	let sortOrder = '0';

	const crud = createCrudList<Skill>(
		{ list: () => listSkills('all'), create: createSkill, update: updateSkill, remove: deleteSkill },
		{
			getPayload: () => ({
				name: name.trim(),
				level,
				recency,
				category: category.trim() || 'general',
				sort_order: Number(sortOrder) || 0
			}),
			applyToForm: (item) => {
				name = item.name;
				level = item.level as (typeof levels)[number];
				recency = (item.recency as (typeof recencies)[number]) || 'current';
				category = item.category;
				sortOrder = String(item.sort_order);
			},
			resetFields: () => {
				name = '';
				level = 'intermediate';
				recency = 'current';
				category = 'general';
				sortOrder = String(confirmed.length);
			},
			getDeleteLabel: (item) => item.name?.trim() || 'this skill',
			validate: () => (!name.trim() ? 'Skill name is required' : null),
			canSave: () => name.trim().length > 0,
			onChange: () => shell?.refreshPreview(),
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'skills', entity: 'Skill' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	$: pending = $items.filter((s) => s.status === 'pending');
	$: confirmed = $items.filter((s) => s.status !== 'pending' && s.status !== 'dismissed');
	$: dismissed = $items.filter((s) => s.status === 'dismissed');

	onMount(crud.load);

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

	async function confirm(skill: Skill) {
		try {
			await confirmSkill(skill.id, {
				level: skill.suggested_level || skill.level,
				recency: skill.suggested_recency || skill.recency || 'current',
				category: skill.category
			});
			await crud.load();
			showToast(`Confirmed ${skill.name}`, 'success');
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to confirm skill', 'error');
		}
	}

	async function dismiss(skill: Skill) {
		try {
			await dismissSkill(skill.id);
			await crud.load();
			showToast(`Dismissed ${skill.name}`, 'success');
		} catch {
			showToast('Failed to dismiss skill', 'error');
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit skill' : 'Skills'}
		description="Add manually anytime, or confirm suggestions from skills developed on experience, projects, education, and certifications."
	/>

	{#if !$formOpen}
		<div class="toolbar">
			<Button on:click={crud.openAdd}>+ Add skill</Button>
		</div>
	{/if}

	{#if $formOpen}
		<Card>
			<h2 class="section-title">{$editingId ? 'Edit skill' : 'Add skill'}</h2>
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
				{#if $editingId}
					<Button on:click={crud.saveEdit}>Save changes</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{:else}
					<Button disabled={$saving} on:click={crud.add}>{$saving ? 'Adding…' : 'Add skill'}</Button>
					<Button variant="ghost" on:click={crud.resetForm}>Cancel</Button>
				{/if}
			</div>
		</Card>
	{/if}

	{#if $loading}
		<p class="muted">Loading…</p>
	{:else}
		{#if pending.length > 0}
			<section class="block">
				<h2 class="section-title">Suggested</h2>
				<ul class="list">
					{#each pending as skill (skill.id)}
						<ContentListItem>
							<strong>{skill.name}</strong>
							<span class="meta">
								{#if suggestHint(skill)}{suggestHint(skill)}{:else}{skill.level}{/if}
								{#if seenOn(skill)} · {seenOn(skill)}{/if}
							</span>
							<svelte:fragment slot="actions">
								<Button on:click={() => confirm(skill)}>Confirm</Button>
								<Button variant="ghost" on:click={() => dismiss(skill)}>Dismiss</Button>
							</svelte:fragment>
						</ContentListItem>
					{/each}
				</ul>
			</section>
		{/if}

		{#if confirmed.length === 0 && pending.length === 0}
			<p class="muted empty">
				No skills yet — add one above, or list skills developed on library items and suggest.
			</p>
		{:else if confirmed.length > 0}
			<section class="block">
				<h2 class="section-title">Your skills</h2>
				<ul class="list">
					{#each confirmed as skill (skill.id)}
						<ContentListItem onEdit={() => crud.startEdit(skill)} onRemove={() => crud.remove(skill)}>
							<strong>{skill.name}</strong>
							<span class="meta">{skill.level} · {skill.recency ?? 'current'} · {skill.category}</span>
						</ContentListItem>
					{/each}
				</ul>
			</section>
		{/if}

		{#if dismissed.length > 0}
			<details class="block muted">
				<summary>Dismissed ({dismissed.length})</summary>
				<ul class="list">
					{#each dismissed as skill (skill.id)}
						<ContentListItem>
							<strong>{skill.name}</strong>
							<span class="meta">Won't re-suggest from library</span>
							<svelte:fragment slot="actions">
								<Button variant="ghost" on:click={() => confirm(skill)}>Restore</Button>
								<Button variant="ghost" on:click={() => crud.remove(skill)}>Delete</Button>
							</svelte:fragment>
						</ContentListItem>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</EditorWithPreview>

<style>
	.toolbar {
		display: flex;
		gap: 0.5rem;
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
		position: sticky;
		bottom: 0;
		z-index: 5;
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.75rem 0 0.25rem;
		background: linear-gradient(
			to top,
			var(--color-surface) 70%,
			color-mix(in srgb, var(--color-surface) 0%, transparent)
		);
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
	details summary {
		cursor: pointer;
		margin-bottom: 0.75rem;
	}
</style>
