<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		listExperience,
		createExperience,
		updateExperience,
		deleteExperience,
		type Experience
	} from '$lib/api/experience';
	import { showToast } from '$lib/stores/toast';

	let items: Experience[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;
	let present = false;

	let company = '';
	let role = '';
	let location = '';
	let startDate = '';
	let endDate = '';
	let description = '';
	let articleUrl = '';
	let sortOrder = '0';

	onMount(load);

	async function load() {
		loading = true;
		try {
			items = await listExperience();
		} catch {
			items = [];
			showToast('Failed to load experience', 'error');
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		company = '';
		role = '';
		location = '';
		startDate = '';
		endDate = '';
		description = '';
		articleUrl = '';
		present = false;
		sortOrder = String(items.length);
		editingId = null;
	}

	function payload(): Partial<Experience> {
		return {
			company: company.trim(),
			role: role.trim(),
			location,
			start_date: startDate,
			end_date: present ? null : endDate || null,
			description,
			article_url: articleUrl,
			sort_order: Number(sortOrder) || 0
		};
	}

	async function add() {
		if (!company.trim() || !role.trim() || !startDate) {
			showToast('Company, role, and start date are required', 'error');
			return;
		}
		saving = true;
		try {
			items = await createExperience(payload());
			showToast('Experience added', 'success');
			resetForm();
		} catch {
			showToast('Failed to add experience', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(item: Experience) {
		editingId = item.id;
		company = item.company;
		role = item.role;
		location = item.location;
		startDate = item.start_date;
		endDate = item.end_date ?? '';
		present = !item.end_date;
		description = item.description;
		articleUrl = item.article_url ?? '';
		sortOrder = String(item.sort_order);
	}

	async function saveEdit() {
		if (!editingId) return;
		saving = true;
		try {
			await updateExperience(editingId, payload());
			await load();
			showToast('Experience updated', 'success');
			resetForm();
		} catch {
			showToast('Failed to update experience', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		try {
			await deleteExperience(id);
			items = items.filter((e) => e.id !== id);
			if (editingId === id) resetForm();
			showToast('Experience deleted', 'success');
		} catch {
			showToast('Failed to delete experience', 'error');
		}
	}
</script>

<PageHeader
	title="Experience"
	description="Work history — optional case-study / write-up links for resume deep dives."
/>

<Card>
	<h2 class="section-title">{editingId ? 'Edit role' : 'Add role'}</h2>
	<div class="fields">
		<div class="row">
			<Input label="Company" bind:value={company} placeholder="Acme Inc." />
			<Input label="Role" bind:value={role} placeholder="Software Engineer" />
		</div>
		<Input label="Location" bind:value={location} placeholder="Remote" />
		<div class="row">
			<Input label="Start date" bind:value={startDate} placeholder="2022-01" />
			<Input label="End date" bind:value={endDate} placeholder="2024-06" disabled={present} />
		</div>
		<label class="checkbox">
			<input type="checkbox" bind:checked={present} />
			Currently working here
		</label>
		<Textarea label="Description" bind:value={description} rows={4} />
		<Input
			label="Case study / write-up URL"
			bind:value={articleUrl}
			placeholder="https://… (external blog or future Foliyo post)"
		/>
		<Input label="Sort order" bind:value={sortOrder} />
	</div>
	<div class="form-actions">
		{#if editingId}
			<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
			<Button variant="ghost" on:click={resetForm}>Cancel</Button>
		{:else}
			<Button disabled={saving} on:click={add}>{saving ? 'Adding…' : 'Add experience'}</Button>
		{/if}
	</div>
</Card>

{#if loading}
	<p class="muted">Loading…</p>
{:else if items.length === 0}
	<p class="muted empty">No experience entries yet.</p>
{:else}
	<ul class="list">
		{#each items as item (item.id)}
			<li>
				<Card>
					<div class="item-row">
						<div>
							<strong>{item.role}</strong> at {item.company}
							<span class="meta">
								{item.start_date} – {item.end_date ?? 'Present'}
								{#if item.location} · {item.location}{/if}
							</span>
							{#if item.description}
								<p class="desc">{item.description}</p>
							{/if}
							{#if item.article_url}
								<p class="meta">
									<a href={item.article_url} target="_blank" rel="noreferrer">View write-up →</a>
								</p>
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
