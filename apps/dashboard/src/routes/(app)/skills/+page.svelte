<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithPreview from '$lib/components/preview/EditorWithPreview.svelte';
	import ContentListItem from '$lib/components/content/ContentListItem.svelte';
	import RecentlyDeleted from '$lib/components/content/RecentlyDeleted.svelte';
	import { createCrudList } from '$lib/utils/crudList';
	import {
		listSkills,
		createSkill,
		updateSkill,
		deleteSkill,
		listDeletedSkills,
		restoreSkill,
		purgeSkill,
		confirmSkill,
		dismissSkill,
		confirmSkillsBulk,
		dismissSkillsBulk,
		type Skill
	} from '$lib/api/skills';
	import { showToast } from '$lib/stores/toast';

	const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
	const recencies = ['current', 'past'] as const;

	let shell: EditorWithPreview;
	let trash: RecentlyDeleted;

	let name = '';
	let level: (typeof levels)[number] = 'intermediate';
	let recency: (typeof recencies)[number] = 'current';
	let category = 'general';
	let sortOrder = '0';

	let selectedPending = new Set<string>();
	let bulkBusy = false;
	let confirmedSearch = '';
	let activeCategory: string | null = null; // null = All

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
			onChange: async () => {
				await shell?.refreshPreview();
				await trash?.reload();
			},
			onOpen: () => shell?.scrollToForm()
		},
		{ loadName: 'skills', entity: 'Skill' }
	);
	const { items, loading, saving, editingId, formOpen } = crud;

	$: pending = $items.filter((s) => s.status === 'pending');
	$: confirmed = $items.filter((s) => s.status !== 'pending' && s.status !== 'dismissed');
	$: dismissed = $items.filter((s) => s.status === 'dismissed');
	$: categorySuggestions = [
		...new Set(
			confirmed
				.map((s) => s.category?.trim())
				.filter((c): c is string => Boolean(c) && c !== 'general')
		)
	].sort((a, b) => a.localeCompare(b));

	$: pendingIds = pending.map((s) => s.id).join(',');
	$: if (pendingIds !== undefined) {
		const valid = new Set(pending.map((s) => s.id));
		const next = new Set<string>();
		for (const id of selectedPending) {
			if (valid.has(id)) next.add(id);
		}
		if (next.size !== selectedPending.size) selectedPending = next;
	}

	$: skillsByCategory = (() => {
		const map = new Map<string, Skill[]>();
		for (const skill of confirmed) {
			const cat = displayCategory(skill);
			const list = map.get(cat) ?? [];
			list.push(skill);
			map.set(cat, list);
		}
		return [...map.entries()].sort(([a], [b]) => {
			if (a === 'Uncategorized') return 1;
			if (b === 'Uncategorized') return -1;
			return a.localeCompare(b);
		});
	})();

	$: searchQ = confirmedSearch.trim().toLowerCase();
	$: filteredByCategory = (() => {
		const entries =
			activeCategory == null
				? skillsByCategory
				: skillsByCategory.filter(([cat]) => cat === activeCategory);
		if (!searchQ) return entries;
		return entries
			.map(([cat, skills]) => [cat, skills.filter((s) => s.name.toLowerCase().includes(searchQ))] as const)
			.filter(([, skills]) => skills.length > 0);
	})();

	$: filteredConfirmedCount = filteredByCategory.reduce((n, [, skills]) => n + skills.length, 0);
	$: useCollapsedGroups = activeCategory == null && skillsByCategory.length > 2 && !searchQ;
	$: selectedCount = selectedPending.size;
	$: allPendingSelected = pending.length > 0 && selectedCount === pending.length;
	$: if (
		activeCategory != null &&
		!skillsByCategory.some(([cat]) => cat === activeCategory)
	) {
		activeCategory = null;
	}

	onMount(crud.load);

	function displayCategory(skill: Skill): string {
		const raw = skill.category?.trim() || '';
		return !raw || raw === 'general' ? 'Uncategorized' : raw;
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

	function togglePending(id: string, checked: boolean) {
		const next = new Set(selectedPending);
		if (checked) next.add(id);
		else next.delete(id);
		selectedPending = next;
	}

	function selectAllPending() {
		selectedPending = new Set(pending.map((s) => s.id));
	}

	function clearPendingSelection() {
		selectedPending = new Set();
	}

	function setCategoryFilter(cat: string | null) {
		activeCategory = cat;
	}

	function categoryOpenByDefault(index: number): boolean {
		if (skillsByCategory.length <= 2) return true;
		return index === 0;
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

	async function runBulkConfirm(ids: string[]) {
		if (!ids.length || bulkBusy) return;
		bulkBusy = true;
		try {
			if (ids.length === 1) {
				const skill = pending.find((s) => s.id === ids[0]);
				await confirmSkill(ids[0], skill
					? {
							level: skill.suggested_level || skill.level,
							recency: skill.suggested_recency || skill.recency || 'current',
							category: skill.category
						}
					: undefined);
				await crud.load();
				showToast(`Confirmed ${skill?.name ?? '1 skill'}`, 'success');
			} else {
				const result = await confirmSkillsBulk(ids);
				await crud.load();
				showToast(`Confirmed ${result.confirmed} skill${result.confirmed === 1 ? '' : 's'}`, 'success');
			}
			clearPendingSelection();
			await shell?.refreshPreview();
		} catch {
			showToast('Failed to confirm skills', 'error');
		} finally {
			bulkBusy = false;
		}
	}

	async function runBulkDismiss(ids: string[]) {
		if (!ids.length || bulkBusy) return;
		bulkBusy = true;
		try {
			if (ids.length === 1) {
				const skill = pending.find((s) => s.id === ids[0]);
				await dismissSkill(ids[0]);
				await crud.load();
				showToast(`Dismissed ${skill?.name ?? '1 skill'}`, 'success');
			} else {
				const result = await dismissSkillsBulk(ids);
				await crud.load();
				showToast(`Dismissed ${result.dismissed} skill${result.dismissed === 1 ? '' : 's'}`, 'success');
			}
			clearPendingSelection();
		} catch {
			showToast('Failed to dismiss skills', 'error');
		} finally {
			bulkBusy = false;
		}
	}
</script>

<EditorWithPreview bind:this={shell}>
	<PageHeader
		title={$editingId ? 'Edit skill' : 'Skills'}
		description="Confirm suggestions in bulk, then browse your library by category or search — pick what visitors see in each portfolio."
	/>
	<RecentlyDeleted
		bind:this={trash}
		listDeleted={listDeletedSkills}
		restore={restoreSkill}
		purge={purgeSkill}
		getLabel={(s) => (s as Skill).name?.trim() || 'Untitled skill'}
		entityLabel="Skill"
		onRestored={async () => {
			await crud.load();
			await shell?.refreshPreview();
		}}
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
						{#each levels as l (l)}
							<option value={l}>{l}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span class="label">Recency</span>
					<select bind:value={recency}>
						{#each recencies as r (r)}
							<option value={r}>{r}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span class="label">Category</span>
					<input
						bind:value={category}
						list="skill-category-suggestions"
						placeholder="e.g. Backend, Design, Leadership"
					/>
					<datalist id="skill-category-suggestions">
						{#each categorySuggestions as c (c)}
							<option value={c}></option>
						{/each}
					</datalist>
				</label>
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
				<div class="section-head">
					<h2 class="section-title">Suggested</h2>
					<span class="muted count">{pending.length}</span>
				</div>

				<div class="pending-bar" class:busy={bulkBusy}>
					<div class="pending-bar-select">
						{#if allPendingSelected}
							<Button variant="ghost" disabled={bulkBusy} on:click={clearPendingSelection}>Clear</Button>
						{:else}
							<Button variant="ghost" disabled={bulkBusy} on:click={selectAllPending}>Select all</Button>
						{/if}
						{#if selectedCount > 0}
							<span class="muted select-count">{selectedCount} selected</span>
						{/if}
					</div>
					<div class="pending-bar-actions">
						<Button
							disabled={bulkBusy || selectedCount === 0}
							on:click={() => runBulkConfirm([...selectedPending])}
						>
							Confirm selected
						</Button>
						<Button
							variant="ghost"
							disabled={bulkBusy || selectedCount === 0}
							on:click={() => runBulkDismiss([...selectedPending])}
						>
							Dismiss selected
						</Button>
						<Button disabled={bulkBusy} on:click={() => runBulkConfirm(pending.map((s) => s.id))}>
							Confirm all
						</Button>
						<Button
							variant="ghost"
							disabled={bulkBusy}
							on:click={() => runBulkDismiss(pending.map((s) => s.id))}
						>
							Dismiss all
						</Button>
					</div>
				</div>

				<ul class="list pending-list">
					{#each pending as skill (skill.id)}
						<li class="pending-row">
							<label class="pending-check">
								<input
									type="checkbox"
									checked={selectedPending.has(skill.id)}
									disabled={bulkBusy}
									aria-label="Select {skill.name}"
									on:change={(e) => togglePending(skill.id, e.currentTarget.checked)}
								/>
							</label>
							<div class="pending-detail">
								<strong>{skill.name}</strong>
								<span class="meta">
									{#if suggestHint(skill)}{suggestHint(skill)}{:else}{skill.level}{/if}
									{#if seenOn(skill)} · {seenOn(skill)}{/if}
								</span>
							</div>
							<div class="pending-row-actions">
								<Button disabled={bulkBusy} on:click={() => confirm(skill)}>Confirm</Button>
								<Button variant="ghost" disabled={bulkBusy} on:click={() => dismiss(skill)}>Dismiss</Button>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if confirmed.length === 0 && pending.length === 0}
			<p class="muted empty">
				No skills yet — add one above, or list skills developed on library items and suggest.
			</p>
		{:else if confirmed.length > 0}
			<section class="block confirmed-block">
				<div class="section-head">
					<h2 class="section-title">Your skills</h2>
					<span class="muted count">{confirmed.length}</span>
				</div>

				<div class="confirmed-toolbar">
					<label class="search-field">
						<span class="visually-hidden">Search skills</span>
						<input
							type="search"
							bind:value={confirmedSearch}
							placeholder="Search by name…"
							aria-label="Search skills by name"
						/>
					</label>
				</div>

				<div class="category-chips" role="toolbar" aria-label="Filter by category">
					<button
						type="button"
						class="chip"
						class:active={activeCategory == null}
						aria-pressed={activeCategory == null}
						on:click={() => setCategoryFilter(null)}
					>
						All ({searchQ ? filteredConfirmedCount : confirmed.length})
					</button>
					{#each skillsByCategory as [cat, skills] (cat)}
						{@const chipCount = searchQ
							? skills.filter((s) => s.name.toLowerCase().includes(searchQ)).length
							: skills.length}
						{#if !searchQ || chipCount > 0}
							<button
								type="button"
								class="chip"
								class:active={activeCategory === cat}
								aria-pressed={activeCategory === cat}
								on:click={() => setCategoryFilter(cat)}
							>
								{cat} ({chipCount})
							</button>
						{/if}
					{/each}
				</div>

				{#if filteredConfirmedCount === 0}
					<p class="muted empty-filter">No skills match this filter.</p>
				{:else if activeCategory != null}
					<h3 class="category-heading">{activeCategory}</h3>
					<ul class="skill-rows">
						{#each filteredByCategory[0]?.[1] ?? [] as skill (skill.id)}
							<li class="skill-row">
								<div class="skill-row-main">
									<strong>{skill.name}</strong>
									<span class="meta">
										{skill.level} · {skill.recency ?? 'current'}
										{#if seenOn(skill)} · {seenOn(skill)}{/if}
									</span>
								</div>
								<div class="skill-row-actions">
									<Button variant="ghost" on:click={() => crud.startEdit(skill)}>Edit</Button>
									<Button variant="ghost" on:click={() => crud.remove(skill)}>Delete</Button>
								</div>
							</li>
						{/each}
					</ul>
				{:else if useCollapsedGroups}
					{#each filteredByCategory as [cat, skills], i (cat)}
						<details class="category-details" open={categoryOpenByDefault(i)}>
							<summary class="category-summary">{cat} <span class="muted">({skills.length})</span></summary>
							<ul class="skill-rows">
								{#each skills as skill (skill.id)}
									<li class="skill-row">
										<div class="skill-row-main">
											<strong>{skill.name}</strong>
											<span class="meta">
												{skill.level} · {skill.recency ?? 'current'}
												{#if seenOn(skill)} · {seenOn(skill)}{/if}
											</span>
										</div>
										<div class="skill-row-actions">
											<Button variant="ghost" on:click={() => crud.startEdit(skill)}>Edit</Button>
											<Button variant="ghost" on:click={() => crud.remove(skill)}>Delete</Button>
										</div>
									</li>
								{/each}
							</ul>
						</details>
					{/each}
				{:else}
					{#each filteredByCategory as [cat, skills] (cat)}
						<div class="category-group">
							{#if filteredByCategory.length > 1 || searchQ}
								<h3 class="category-heading">{cat}</h3>
							{/if}
							<ul class="skill-rows">
								{#each skills as skill (skill.id)}
									<li class="skill-row">
										<div class="skill-row-main">
											<strong>{skill.name}</strong>
											<span class="meta">
												{skill.level} · {skill.recency ?? 'current'}
												{#if seenOn(skill)} · {seenOn(skill)}{/if}
											</span>
										</div>
										<div class="skill-row-actions">
											<Button variant="ghost" on:click={() => crud.startEdit(skill)}>Edit</Button>
											<Button variant="ghost" on:click={() => crud.remove(skill)}>Delete</Button>
										</div>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				{/if}
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
	.section-head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.section-title {
		margin: 0 0 1rem;
		font-size: 1rem;
	}
	.section-head .section-title {
		margin: 0;
	}
	.count {
		font-size: 0.8125rem;
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
	select,
	.field input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
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
	.empty-filter {
		margin: 0.75rem 0 0;
		font-size: 0.875rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Suggested / pending */
	.pending-bar {
		position: sticky;
		top: 0;
		z-index: 4;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 0.75rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}
	.pending-bar.busy {
		opacity: 0.75;
	}
	.pending-bar-select,
	.pending-bar-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}
	.select-count {
		font-size: 0.8125rem;
		margin-left: 0.25rem;
	}
	.pending-list {
		gap: 0.35rem;
	}
	.pending-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}
	.pending-check {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		cursor: pointer;
	}
	.pending-check input {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-accent, var(--color-text));
	}
	.pending-detail {
		min-width: 0;
		flex: 1;
	}
	.pending-detail .meta {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-muted);
		margin-top: 0.15rem;
	}
	.pending-row-actions {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	/* Confirmed */
	.confirmed-toolbar {
		margin-bottom: 0.65rem;
	}
	.search-field input {
		width: 100%;
		max-width: 22rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 0.875rem;
	}
	.category-chips {
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 0.85rem;
		padding: 0.45rem 0;
		background: linear-gradient(
			to bottom,
			var(--color-surface) 70%,
			color-mix(in srgb, var(--color-surface) 85%, transparent)
		);
		border-bottom: 1px solid var(--color-border);
	}
	.chip {
		padding: 0.28rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.chip:hover {
		border-color: color-mix(in srgb, var(--color-text) 35%, var(--color-border));
	}
	.chip.active {
		border-color: var(--color-text);
		background: color-mix(in srgb, var(--color-text) 8%, transparent);
		font-weight: 600;
	}
	.category-heading {
		margin: 0 0 0.4rem;
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.category-group {
		margin-bottom: 0.85rem;
	}
	.category-details {
		margin-bottom: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 0 0.65rem 0.35rem;
	}
	.category-summary {
		cursor: pointer;
		padding: 0.55rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		list-style-position: outside;
	}
	.skill-rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.category-details .skill-rows {
		border: none;
		border-top: 1px solid var(--color-border);
		border-radius: 0;
		margin: 0 -0.65rem;
	}
	.skill-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.4rem 0.65rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.skill-row:last-child {
		border-bottom: none;
	}
	.skill-row-main {
		min-width: 0;
		flex: 1;
	}
	.skill-row-main strong {
		font-size: 0.875rem;
	}
	.skill-row-main .meta {
		display: block;
		font-size: 0.75rem;
		color: var(--color-muted);
		margin-top: 0.1rem;
	}
	.skill-row-actions {
		display: flex;
		gap: 0.15rem;
		flex-shrink: 0;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	details.block summary {
		cursor: pointer;
		margin-bottom: 0.75rem;
	}

	@media (max-width: 640px) {
		.pending-row {
			flex-wrap: wrap;
		}
		.pending-row-actions {
			width: 100%;
			justify-content: flex-end;
			padding-left: 1.65rem;
		}
		.skill-row {
			flex-wrap: wrap;
		}
		.skill-row-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
