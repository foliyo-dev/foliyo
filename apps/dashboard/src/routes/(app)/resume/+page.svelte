<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
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
	import { getProfile, type Profile } from '$lib/api/profile';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let items: Resume[] = [];
	let portfolios: Portfolio[] = [];
	let profile: Profile | null = null;
	let loading = true;
	let saving = false;
	let exportingId: string | null = null;
	let editingId: string | null = null;
	let previewingId: string | null = null;
	let editorPreview: EditorWithResumePreview;

	let name = '';
	let headline = '';
	let bio = '';
	let portfolioId = '';
	let themeSlug: (typeof resumeThemes)[number] = 'classic';
	let isPublic = false;
	let customSummaryOpen = false;

	$: previewResume = items.find((r) => r.id === previewingId) ?? null;
	$: hasOwnSummary = Boolean(headline.trim() || bio.trim());
	$: draftSummary =
		editingId && (hasOwnSummary || customSummaryOpen)
			? { headline, bio, theme_slug: themeSlug }
			: null;
	$: fallbackSummary = effectiveFallbackSummary(portfolioId, profile, portfolios);

	function effectiveFallbackSummary(
		linkedFolioId: string,
		p: Profile | null,
		folios: Portfolio[]
	): { message: string; editHref: string; editLabel: string } | null {
		const folio = linkedFolioId ? folios.find((f) => f.id === linkedFolioId) : null;
		const folioHeadline = String(folio?.headline ?? '').trim();
		const folioBio = String(folio?.bio ?? '').trim();
		if (folioHeadline || folioBio) {
			return {
				message: `the linked folio “${folio?.name ?? 'Portfolio'}” headline and summary`,
				editHref: `/portfolios/${linkedFolioId}`,
				editLabel: 'folio'
			};
		}
		const profileHeadline = String(p?.headline ?? '').trim();
		const profileBio = String(p?.bio ?? '').trim();
		if (profileHeadline || profileBio) {
			return {
				message: 'Basics headline and summary',
				editHref: '/basics',
				editLabel: 'Basics'
			};
		}
		return null;
	}

	onMount(load);

	async function load() {
		loading = true;
		try {
			const [resumes, p, prof] = await Promise.all([
				listResumes(),
				listPortfolios(),
				getProfile().catch(() => null)
			]);
			items = resumes;
			portfolios = p;
			profile = prof;
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
		headline = '';
		bio = '';
		portfolioId = '';
		themeSlug = 'classic';
		isPublic = false;
		customSummaryOpen = false;
	}

	function startEdit(r: Resume) {
		editingId = r.id;
		name = r.name;
		headline = r.headline ?? '';
		bio = r.bio ?? '';
		customSummaryOpen = Boolean(String(r.headline ?? '').trim() || String(r.bio ?? '').trim());
		portfolioId = r.portfolio_id ?? '';
		themeSlug = r.theme_slug as (typeof resumeThemes)[number];
		isPublic = r.is_public === 1;
		previewingId = r.id;
	}

	function openCustomSummary() {
		customSummaryOpen = true;
	}

	function useFallbackSummary() {
		headline = '';
		bio = '';
		customSummaryOpen = false;
	}

	async function saveEdit() {
		if (!editingId) return;
		if (!name.trim()) {
			showToast('Resume name is required', 'error');
			return;
		}
		saving = true;
		try {
			const trimmedHeadline = headline.trim();
			const trimmedBio = bio.trim();
			await updateResume(editingId, {
				name: name.trim(),
				headline: trimmedHeadline,
				bio: trimmedBio,
				portfolio_id: portfolioId || null,
				theme_slug: themeSlug,
				is_public: isPublic ? 1 : 0
			});
			items = items.map((r) =>
				r.id === editingId
					? {
							...r,
							name: name.trim(),
							headline: trimmedHeadline,
							bio: trimmedBio,
							portfolio_id: portfolioId || null,
							theme_slug: themeSlug,
							is_public: isPublic ? 1 : 0
						}
					: r
			);
			await editorPreview?.refreshPreview();
			showToast('Resume updated', 'success');
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

{#if loading}
	<p class="muted">Loading…</p>
{:else}
	<EditorWithResumePreview
		bind:this={editorPreview}
		resumeId={previewResume?.id ?? null}
		resumeName={previewResume?.name ?? 'Resume'}
		{draftSummary}
	>
		{#if editingId}
			<Card>
				<div class="create-head">
					<h2 class="section-title">Edit resume</h2>
					<Button variant="ghost" on:click={resetEdit}>Cancel</Button>
				</div>
				<div class="fields">
					<Input label="Name" bind:value={name} />
					<div class="summary-section">
						<h3 class="summary-title">Resume summary</h3>
						{#if !customSummaryOpen && !hasOwnSummary && fallbackSummary}
							<p class="summary-using">
								This resume uses {fallbackSummary.message}.
							</p>
							<div class="summary-actions">
								<Button variant="secondary" on:click={openCustomSummary}>
									Add separate summary
								</Button>
								<a class="summary-link" href={fallbackSummary.editHref}>
									Edit {fallbackSummary.editLabel}
								</a>
							</div>
						{:else}
							<Input
								label="Headline"
								bind:value={headline}
								placeholder="e.g. Full-stack engineer focused on product delivery"
							/>
							<Textarea
								label="Professional summary"
								bind:value={bio}
								rows={4}
								placeholder="Short summary for this resume…"
							/>
							{#if fallbackSummary}
								<button type="button" class="linkish" on:click={useFallbackSummary}>
									Use {fallbackSummary.editLabel} instead
								</button>
							{/if}
						{/if}
					</div>
					<label class="field">
						<span class="label">Linked folio (optional)</span>
						<select bind:value={portfolioId}>
							<option value="">None</option>
							{#each portfolios as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
						<p class="hint">Metadata only — does not change resume content.</p>
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

		{#if items.length === 0}
			<Card>
				<p class="muted empty">No resumes yet.</p>
				<p class="hint">
					<a href="/resume/tailor">Tailor to a job</a>
					or
					<a href="/resume/new">pick from library</a>.
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
										{#if r.portfolio_id}Linked: {portfolioName(r.portfolio_id)} · {/if}{r.theme_slug} · {r.view_count}
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
	.summary-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.summary-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.summary-using {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.summary-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
	}
	.summary-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-primary);
		text-decoration: none;
	}
	.summary-link:hover {
		text-decoration: underline;
	}
	.linkish {
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-primary);
		cursor: pointer;
		text-align: left;
	}
	.linkish:hover {
		text-decoration: underline;
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
