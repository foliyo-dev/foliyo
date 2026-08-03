<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		listResumes,
		createResume,
		updateResume,
		deleteResume,
		regenerateResumeToken,
		resumeThemes,
		resumeShareUrl,
		type Resume
	} from '$lib/api/resumes';
	import { listPortfolios, type Portfolio } from '$lib/api/portfolios';
	import { showToast } from '$lib/stores/toast';

	let items: Resume[] = [];
	let portfolios: Portfolio[] = [];
	let loading = true;
	let saving = false;
	let editingId: string | null = null;

	let name = '';
	let portfolioId = '';
	let themeSlug: (typeof resumeThemes)[number] = 'classic';
	let isPublic = false;

	onMount(load);

	async function load() {
		loading = true;
		try {
			[items, portfolios] = await Promise.all([listResumes(), listPortfolios()]);
			if (!portfolioId && portfolios[0]) portfolioId = portfolios[0].id;
		} catch {
			items = [];
			portfolios = [];
			showToast('Failed to load resumes', 'error');
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		name = '';
		themeSlug = 'classic';
		isPublic = false;
		if (portfolios[0]) portfolioId = portfolios[0].id;
		editingId = null;
	}

	function portfolioName(id: string) {
		return portfolios.find((p) => p.id === id)?.name ?? 'Portfolio';
	}

	async function add() {
		if (!name.trim() || !portfolioId) {
			showToast('Name and portfolio are required', 'error');
			return;
		}
		saving = true;
		try {
			items = await createResume({
				name: name.trim(),
				portfolio_id: portfolioId,
				theme_slug: themeSlug,
				is_public: isPublic ? 1 : 0
			});
			showToast('Resume created', 'success');
			resetForm();
		} catch {
			showToast('Failed to create resume', 'error');
		} finally {
			saving = false;
		}
	}

	function startEdit(r: Resume) {
		editingId = r.id;
		name = r.name;
		portfolioId = r.portfolio_id;
		themeSlug = r.theme_slug as (typeof resumeThemes)[number];
		isPublic = r.is_public === 1;
	}

	async function saveEdit() {
		if (!editingId) return;
		saving = true;
		try {
			await updateResume(editingId, {
				name: name.trim(),
				portfolio_id: portfolioId,
				theme_slug: themeSlug,
				is_public: isPublic ? 1 : 0
			});
			await load();
			showToast('Resume updated', 'success');
			resetForm();
		} catch {
			showToast('Failed to update resume', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		try {
			await deleteResume(id);
			items = items.filter((r) => r.id !== id);
			if (editingId === id) resetForm();
			showToast('Resume deleted', 'success');
		} catch {
			showToast('Failed to delete resume', 'error');
		}
	}

	async function regenerate(id: string) {
		try {
			const { share_token } = await regenerateResumeToken(id);
			items = items.map((r) => (r.id === id ? { ...r, share_token } : r));
			showToast('Share link regenerated', 'success');
		} catch {
			showToast('Failed to regenerate token', 'error');
		}
	}

	async function copyLink(token: string) {
		const url = resumeShareUrl(token);
		try {
			await navigator.clipboard.writeText(url);
			showToast('Link copied', 'success');
		} catch {
			showToast(url, 'info');
		}
	}
</script>

<PageHeader
	title="Resume"
	description="Shareable resume from a portfolio's curated content."
/>

{#if portfolios.length === 0}
	<Card>
		<p class="muted">
			Create a <a href="/portfolios">portfolio</a> first — resumes reuse that content selection.
		</p>
	</Card>
{:else}
	<Card>
		<h2 class="section-title">{editingId ? 'Edit resume' : 'New resume'}</h2>
		<div class="fields">
			<Input label="Name" bind:value={name} placeholder="Software Engineer — 2026" />
			<label class="field">
				<span class="label">Portfolio</span>
				<select bind:value={portfolioId}>
					{#each portfolios as p}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span class="label">Theme</span>
				<select bind:value={themeSlug}>
					{#each resumeThemes as t}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</label>
			<label class="checkbox">
				<input type="checkbox" bind:checked={isPublic} />
				Public (shareable via link)
			</label>
		</div>
		<div class="form-actions">
			{#if editingId}
				<Button disabled={saving} on:click={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</Button>
				<Button variant="ghost" on:click={resetForm}>Cancel</Button>
			{:else}
				<Button disabled={saving} on:click={add}>{saving ? 'Creating…' : 'Create resume'}</Button>
			{/if}
		</div>
	</Card>
{/if}

{#if loading}
	<p class="muted">Loading…</p>
{:else if items.length === 0}
	<p class="muted empty">No resumes yet.</p>
{:else}
	<ul class="list">
		{#each items as r (r.id)}
			<li>
				<Card>
					<div class="row">
						<div>
							<h2>
								{r.name}
								{#if r.is_public}<span class="tag public">public</span>{:else}<span class="tag private">private</span>{/if}
							</h2>
							<p class="meta">From: {portfolioName(r.portfolio_id)} · {r.theme_slug} theme · {r.view_count} views</p>
							{#if r.is_public}
								<p class="link">
									<a href={resumeShareUrl(r.share_token)} target="_blank" rel="noreferrer">
										{resumeShareUrl(r.share_token)}
									</a>
								</p>
							{/if}
						</div>
						<div class="actions">
							<Button variant="ghost" on:click={() => startEdit(r)}>Edit</Button>
							{#if r.is_public}
								<Button variant="ghost" on:click={() => copyLink(r.share_token)}>Copy link</Button>
								<Button variant="ghost" on:click={() => regenerate(r.id)}>Regenerate link</Button>
							{/if}
							<Button variant="ghost" on:click={() => remove(r.id)}>Delete</Button>
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
	.row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h2 {
		margin: 0;
		font-size: 1.0625rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.tag {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 0.1rem 0.45rem;
		border-radius: 4px;
	}
	.tag.public {
		background: #dcfce7;
		color: #166534;
	}
	.tag.private {
		background: #f3f4f6;
		color: var(--color-muted);
	}
	.meta {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.link {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		font-family: ui-monospace, monospace;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
</style>
