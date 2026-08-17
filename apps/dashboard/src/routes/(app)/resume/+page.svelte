<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithResumePreview from '$lib/components/preview/EditorWithResumePreview.svelte';
	import {
		listResumes,
		updateResume,
		deleteResume,
		regenerateResumeToken,
		resumeThemes,
		resumeShareUrl,
		downloadResumeFio,
		type Resume
	} from '$lib/api/resumes';
	import { listPortfolios, type Portfolio } from '$lib/api/portfolios';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let items: Resume[] = [];
	let portfolios: Portfolio[] = [];
	let loading = true;
	let saving = false;
	let exportingId: string | null = null;
	let editingId: string | null = null;
	let previewingId: string | null = null;

	let name = '';
	let portfolioId = '';
	let themeSlug: (typeof resumeThemes)[number] = 'classic';
	let isPublic = false;

	$: previewResume = items.find((r) => r.id === previewingId) ?? null;

	onMount(load);

	async function load() {
		loading = true;
		try {
			const [resumes, p] = await Promise.all([listResumes(), listPortfolios()]);
			items = resumes;
			portfolios = p;
			const fromUrl = $page.url.searchParams.get('preview');
			if (fromUrl && items.some((r) => r.id === fromUrl)) previewingId = fromUrl;
			if (previewingId && !items.some((r) => r.id === previewingId)) previewingId = null;
		} catch {
			items = [];
			portfolios = [];
			showToast('Failed to load resumes', 'error');
		} finally {
			loading = false;
		}
	}

	function portfolioName(id: string | null) {
		if (!id) return '—';
		return portfolios.find((p) => p.id === id)?.name ?? 'Portfolio';
	}

	function togglePreview(id: string) {
		previewingId = previewingId === id ? null : id;
	}

	function resetEdit() {
		editingId = null;
		name = '';
		themeSlug = 'classic';
		isPublic = false;
	}

	function startEdit(r: Resume) {
		editingId = r.id;
		name = r.name;
		portfolioId = r.portfolio_id ?? '';
		themeSlug = r.theme_slug as (typeof resumeThemes)[number];
		isPublic = r.is_public === 1;
		previewingId = r.id;
	}

	async function saveEdit() {
		if (!editingId) return;
		if (!name.trim()) {
			showToast('Resume name is required', 'error');
			return;
		}
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
			resetEdit();
		} catch {
			showToast('Failed to update resume', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		const item = items.find((r) => r.id === id);
		if (!(await confirmDelete(item?.name?.trim() || 'this resume'))) return;
		try {
			await deleteResume(id);
			items = items.filter((r) => r.id !== id);
			if (editingId === id) resetEdit();
			if (previewingId === id) previewingId = null;
			showToast('Resume deleted', 'success');
		} catch {
			showToast('Failed to delete resume', 'error');
		}
	}

	async function setVisibility(r: Resume, makePublic: boolean) {
		try {
			await updateResume(r.id, { is_public: makePublic ? 1 : 0 });
			items = items.map((item) =>
				item.id === r.id ? { ...item, is_public: makePublic ? 1 : 0 } : item
			);
			showToast(makePublic ? 'Resume is public' : 'Resume is private', 'success');
		} catch {
			showToast('Failed to update visibility', 'error');
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

	async function downloadFio(r: Resume) {
		exportingId = r.id;
		try {
			await downloadResumeFio(r.id, r.name);
			showToast('Downloaded .fio package', 'success');
		} catch {
			showToast('Failed to export .fio', 'error');
		} finally {
			exportingId = null;
		}
	}
</script>

<PageHeader
	title="Resumes"
	description="Preview, share, or export snapshots you’ve already made. Tailor a new one from a JD, or copy a folio."
/>

{#if portfolios.length === 0}
	<Card>
		<p class="muted">
			Create a <a href="/portfolios">portfolio</a> first — we’ll seed resumes from it.
		</p>
	</Card>
{:else}
	<EditorWithResumePreview
		resumeId={previewResume?.id ?? null}
		resumeName={previewResume?.name ?? 'Resume'}
	>
		{#if editingId}
			<Card>
				<div class="create-head">
					<h2 class="section-title">Edit resume</h2>
					<Button variant="ghost" on:click={resetEdit}>Cancel</Button>
				</div>
				<div class="fields">
					<Input label="Name" bind:value={name} />
					<label class="field">
						<span class="label">Seeded from portfolio</span>
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
					<div class="mode" role="group" aria-label="Visibility">
						<button
							type="button"
							class="mode-option"
							class:on={!isPublic}
							on:click={() => (isPublic = false)}
						>
							Private
						</button>
						<button
							type="button"
							class="mode-option"
							class:on={isPublic}
							on:click={() => (isPublic = true)}
						>
							Public
						</button>
					</div>
				</div>
				<div class="form-actions">
					<Button disabled={saving} on:click={saveEdit}
						>{saving ? 'Saving…' : 'Save changes'}</Button
					>
				</div>
			</Card>
		{/if}

		{#if loading}
			<p class="muted">Loading…</p>
		{:else if items.length === 0}
			<Card>
				<p class="muted empty">No resumes yet.</p>
				<p class="hint">
					<a href="/resume/tailor">Tailor to a job</a>
					or
					<a href="/resume/new">copy a folio</a>.
				</p>
			</Card>
		{:else}
			<ul class="list">
				{#each items as r (r.id)}
					<li class:previewing={previewingId === r.id} aria-current={previewingId === r.id ? 'true' : undefined}>
						<Card>
							<div class="row">
								<div>
									<h2>
										{r.name}
										{#if previewingId === r.id}<span class="tag previewing">previewing</span>{/if}
										{#if r.is_public}<span class="tag public">public</span>{:else}<span
												class="tag private">private</span
											>{/if}
									</h2>
									<p class="meta">
										From: {portfolioName(r.portfolio_id)} · {r.theme_slug} · {r.view_count}
										views
									</p>
									{#if r.is_public}
										<p class="link">
											<a
												href={resumeShareUrl(r.share_token)}
												target="_blank"
												rel="noreferrer"
											>
												{resumeShareUrl(r.share_token)}
											</a>
										</p>
									{/if}
								</div>
								<div class="actions">
									<Button
										variant="ghost"
										on:click={() => togglePreview(r.id)}
										pressed={previewingId === r.id}
									>
										{previewingId === r.id ? 'Hide preview' : 'Preview'}
									</Button>
									{#if r.is_public}
										<Button variant="ghost" on:click={() => setVisibility(r, false)}
											>Make private</Button
										>
										<Button variant="ghost" on:click={() => copyLink(r.share_token)}
											>Copy link</Button
										>
										<Button variant="ghost" on:click={() => regenerate(r.id)}
											>Regenerate link</Button
										>
									{:else}
										<Button variant="ghost" on:click={() => setVisibility(r, true)}
											>Make public</Button
										>
									{/if}
									<Button variant="ghost" on:click={() => startEdit(r)}>Edit</Button>
									<Button
										variant="ghost"
										disabled={exportingId === r.id}
										on:click={() => downloadFio(r)}
									>
										{exportingId === r.id ? 'Exporting…' : 'Download .fio'}
									</Button>
									<Button variant="ghost" on:click={() => remove(r.id)}>Delete</Button>
								</div>
							</div>
						</Card>
					</li>
				{/each}
			</ul>
		{/if}
	</EditorWithResumePreview>
{/if}

<style>
	.section-title {
		margin: 0;
		font-size: 1rem;
	}
	.create-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
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
		font: inherit;
		color: var(--color-text);
	}
	.hint {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.mode {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.35rem;
		padding: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.mode-option {
		border: 0;
		background: transparent;
		padding: 0.55rem 0.4rem;
		border-radius: 6px;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-muted);
		cursor: pointer;
	}
	.mode-option.on {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 1px 2px rgba(26, 26, 46, 0.06);
	}
	.form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.muted {
		color: var(--color-muted);
	}
	.meta {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.empty {
		margin: 0;
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
	.tag.previewing {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}
	.list li.previewing :global(.card) {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
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
	:global(.card + .card) {
		margin-top: 1rem;
	}
</style>
