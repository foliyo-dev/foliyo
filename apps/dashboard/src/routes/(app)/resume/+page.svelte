<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EditorWithResumePreview from '$lib/components/preview/EditorWithResumePreview.svelte';
	import PortfolioLibraryPicker from '$lib/components/portfolio/PortfolioLibraryPicker.svelte';
	import {
		listResumes,
		createResume,
		updateResume,
		deleteResume,
		regenerateResumeToken,
		tailorResume,
		resumeThemes,
		resumeShareUrl,
		downloadResumeFio,
		type Resume,
		type TailorAnalysis
	} from '$lib/api/resumes';
	import { listPortfolios, getPortfolio, type Portfolio } from '$lib/api/portfolios';
	import { listSkills, type Skill } from '$lib/api/skills';
	import { listProjects, type Project } from '$lib/api/projects';
	import { listExperience, type Experience } from '$lib/api/experience';
	import { listEducation, type Education } from '$lib/api/education';
	import { listCertifications, type Certification } from '$lib/api/certifications';
	import { listLanguages, type Language } from '$lib/api/languages';
	import { showToast } from '$lib/stores/toast';
	import { ApiError } from '$lib/api/client';

	type TargetMode = 'portfolio' | 'jd' | 'custom';

	let items: Resume[] = [];
	let portfolios: Portfolio[] = [];
	let skills: Skill[] = [];
	let projects: Project[] = [];
	let experiences: Experience[] = [];
	let educations: Education[] = [];
	let certifications: Certification[] = [];
	let languages: Language[] = [];
	let loading = true;
	let saving = false;
	let seedingCustom = false;
	let exportingId: string | null = null;
	let editingId: string | null = null;
	let previewingId: string | null = null;
	let analysis: TailorAnalysis | null = null;
	let lastCreatedId: string | null = null;

	let name = '';
	let nameTouched = false;
	let portfolioId = '';
	let themeSlug: (typeof resumeThemes)[number] = 'classic';
	let isPublic = false;
	let targetMode: TargetMode = 'portfolio';
	let jdText = '';
	let includeMatching = true;
	let showAdvanced = false;

	let selectedSkills = new Set<string>();
	let selectedProjects = new Set<string>();
	let selectedExperience = new Set<string>();
	let selectedEducation = new Set<string>();
	let selectedCertifications = new Set<string>();
	let selectedLanguages = new Set<string>();

	$: previewResume = items.find((r) => r.id === previewingId) ?? null;
	$: existingForPortfolio = portfolioId
		? items.filter((r) => r.portfolio_id === portfolioId)
		: [];
	$: customCount =
		selectedSkills.size +
		selectedProjects.size +
		selectedExperience.size +
		selectedEducation.size +
		selectedCertifications.size +
		selectedLanguages.size;
	$: suggestedName = buildSuggestedName();
	$: if (!nameTouched) name = suggestedName;

	onMount(load);

	async function load() {
		loading = true;
		try {
			const [resumes, p, sk, pr, ex, ed, cert, lang] = await Promise.all([
				listResumes(),
				listPortfolios(),
				listSkills('confirmed'),
				listProjects(),
				listExperience(),
				listEducation(),
				listCertifications(),
				listLanguages()
			]);
			items = resumes;
			portfolios = p;
			skills = sk.filter((s) => s.status !== 'dismissed' && s.status !== 'pending');
			projects = pr;
			experiences = ex;
			educations = ed;
			certifications = cert;
			languages = lang;
			if (!portfolioId && portfolios[0]) portfolioId = portfolios[0].id;
			if (previewingId && !items.some((r) => r.id === previewingId)) previewingId = null;
		} catch {
			items = [];
			portfolios = [];
			skills = [];
			projects = [];
			experiences = [];
			educations = [];
			certifications = [];
			languages = [];
			showToast('Failed to load resumes', 'error');
		} finally {
			loading = false;
		}
	}

	function monthYear(): string {
		return new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
	}

	function buildSuggestedName(): string {
		const folio = portfolios.find((p) => p.id === portfolioId)?.name ?? 'Resume';
		const when = monthYear();
		if (targetMode === 'jd' && jdText.trim()) return `${folio} · JD — ${when}`;
		if (targetMode === 'custom') {
			return customCount > 0
				? `${folio} · Custom (${customCount}) — ${when}`
				: `${folio} · Custom — ${when}`;
		}
		return `${folio} — ${when}`;
	}

	function clearCustomSelection() {
		selectedSkills = new Set();
		selectedProjects = new Set();
		selectedExperience = new Set();
		selectedEducation = new Set();
		selectedCertifications = new Set();
		selectedLanguages = new Set();
	}

	async function seedCustomFromPortfolio(pid: string) {
		if (!pid) {
			clearCustomSelection();
			return;
		}
		seedingCustom = true;
		try {
			const detail = await getPortfolio(pid);
			selectedSkills = new Set(detail.content.skill_ids);
			selectedProjects = new Set(detail.content.project_ids);
			selectedExperience = new Set(detail.content.experience_ids);
			selectedEducation = new Set(detail.content.education_ids);
			selectedCertifications = new Set(detail.content.certification_ids);
			selectedLanguages = new Set(detail.content.language_ids);
		} catch {
			clearCustomSelection();
			showToast('Could not load portfolio content for Custom', 'error');
		} finally {
			seedingCustom = false;
		}
	}

	function resetForm() {
		nameTouched = false;
		themeSlug = 'classic';
		isPublic = false;
		targetMode = 'portfolio';
		jdText = '';
		includeMatching = true;
		showAdvanced = false;
		editingId = null;
		analysis = null;
		clearCustomSelection();
		if (portfolios[0]) portfolioId = portfolios[0].id;
		name = buildSuggestedName();
	}

	function portfolioName(id: string | null) {
		if (!id) return '—';
		return portfolios.find((p) => p.id === id)?.name ?? 'Portfolio';
	}

	function togglePreview(id: string) {
		previewingId = previewingId === id ? null : id;
		if (previewingId !== lastCreatedId) analysis = null;
	}

	async function setTargetMode(mode: TargetMode) {
		targetMode = mode;
		if (mode === 'portfolio') {
			jdText = '';
			clearCustomSelection();
		}
		if (mode === 'jd') clearCustomSelection();
		if (mode === 'custom') {
			jdText = '';
			await seedCustomFromPortfolio(portfolioId);
		}
	}

	async function onPortfolioChange() {
		if (targetMode === 'custom') await seedCustomFromPortfolio(portfolioId);
	}

	async function createNew() {
		if (!portfolioId) {
			showToast('Choose a portfolio', 'error');
			return;
		}
		const finalName = (nameTouched ? name : suggestedName).trim() || suggestedName;
		if (!finalName) {
			showToast('Resume name is required', 'error');
			return;
		}

		if (targetMode === 'jd' && !jdText.trim()) {
			showToast('Paste a job description', 'error');
			return;
		}
		if (targetMode === 'custom' && customCount === 0) {
			showToast('Select at least one library item', 'error');
			return;
		}

		saving = true;
		analysis = null;
		try {
			if (targetMode === 'jd') {
				const result = await tailorResume({
					name: finalName,
					portfolio_id: portfolioId,
					theme_slug: themeSlug,
					jd_text: jdText.trim(),
					include_matching: includeMatching,
					is_public: isPublic ? 1 : 0
				});
				items = await listResumes();
				analysis = result.analysis;
				lastCreatedId = result.resume.id;
				previewingId = result.resume.id;
				showToast(
					`Resume created with ${result.matched_skill_ids.length} skill(s)`,
					'success'
				);
			} else if (targetMode === 'custom') {
				items = await createResume({
					name: finalName,
					portfolio_id: portfolioId,
					theme_slug: themeSlug,
					is_public: isPublic ? 1 : 0,
					content: {
						skill_ids: [...selectedSkills],
						project_ids: [...selectedProjects],
						experience_ids: [...selectedExperience],
						education_ids: [...selectedEducation],
						certification_ids: [...selectedCertifications],
						language_ids: [...selectedLanguages]
					}
				});
				const newest = items[0];
				if (newest) {
					lastCreatedId = newest.id;
					previewingId = newest.id;
				}
				showToast(`Custom resume created · ${customCount} item(s)`, 'success');
			} else {
				items = await createResume({
					name: finalName,
					portfolio_id: portfolioId,
					theme_slug: themeSlug,
					is_public: isPublic ? 1 : 0
				});
				const newest = items[0];
				if (newest) {
					lastCreatedId = newest.id;
					previewingId = newest.id;
				}
				showToast('Resume created', 'success');
			}
			nameTouched = false;
			jdText = '';
			clearCustomSelection();
			targetMode = 'portfolio';
			name = buildSuggestedName();
		} catch (err) {
			if (err instanceof ApiError) {
				try {
					const body = JSON.parse(err.message) as { message?: string; error?: string };
					showToast(body.message ?? body.error ?? 'Failed to create resume', 'error');
				} catch {
					showToast(err.message || 'Failed to create resume', 'error');
				}
			} else {
				showToast('Failed to create resume', 'error');
			}
		} finally {
			saving = false;
		}
	}

	function startEdit(r: Resume) {
		editingId = r.id;
		name = r.name;
		nameTouched = true;
		portfolioId = r.portfolio_id ?? '';
		themeSlug = r.theme_slug as (typeof resumeThemes)[number];
		isPublic = r.is_public === 1;
		previewingId = r.id;
		analysis = null;
		showAdvanced = true;
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
			if (previewingId === id) previewingId = null;
			if (lastCreatedId === id) {
				lastCreatedId = null;
				analysis = null;
			}
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
	title={editingId ? 'Edit resume' : 'Resume'}
	description="Create from a whole folio, paste a JD, or build a Custom snapshot by hand. Each resume keeps its own content — your public folio stays unchanged."
/>

{#if portfolios.length === 0}
	<Card>
		<p class="muted">
			Create a <a href="/portfolios">portfolio</a> first — we’ll seed your resume from it.
		</p>
	</Card>
{:else}
	<EditorWithResumePreview
		resumeId={previewResume?.id ?? null}
		resumeName={previewResume?.name ?? 'Resume'}
	>
		<Card>
			{#if editingId}
				<div class="create-head">
					<h2 class="section-title">Edit resume</h2>
					<Button variant="ghost" on:click={resetForm}>Cancel</Button>
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
			{:else}
				<div class="create-head">
					<h2 class="section-title">New resume</h2>
				</div>

				<div class="fields">
					<label class="field">
						<span class="label">From portfolio</span>
						<select
							bind:value={portfolioId}
							on:change={() => onPortfolioChange()}
						>
							{#each portfolios as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
						{#if existingForPortfolio.length > 0}
							<p class="hint">
								{existingForPortfolio.length} resume{existingForPortfolio.length === 1
									? ''
									: 's'} already from this folio — you can create another for a different
								job.
								<button
									type="button"
									class="linkish"
									on:click={() => {
										const latest = existingForPortfolio[0];
										if (latest) togglePreview(latest.id);
									}}
								>
									Preview latest
								</button>
							</p>
						{:else}
							<p class="hint">Copies this folio’s content into a private resume snapshot.</p>
						{/if}
					</label>

					<label class="field">
						<span class="label">Resume name</span>
						<input
							type="text"
							value={name}
							placeholder={suggestedName}
							on:input={(e) => {
								nameTouched = true;
								name = e.currentTarget.value;
							}}
						/>
						{#if !nameTouched}
							<p class="hint">Suggested: {suggestedName}</p>
						{/if}
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
					<p class="hint">
						{isPublic
							? 'Anyone with the link can open this resume.'
							: 'Only you can see it until you make it public.'}
					</p>

					<div class="mode" role="group" aria-label="How to build content">
						<button
							type="button"
							class="mode-option"
							class:on={targetMode === 'portfolio'}
							on:click={() => setTargetMode('portfolio')}
						>
							Whole folio
						</button>
						<button
							type="button"
							class="mode-option"
							class:on={targetMode === 'jd'}
							on:click={() => setTargetMode('jd')}
						>
							Paste JD
						</button>
						<button
							type="button"
							class="mode-option"
							class:on={targetMode === 'custom'}
							on:click={() => setTargetMode('custom')}
						>
							Custom
						</button>
					</div>

					{#if targetMode === 'jd'}
						<Textarea
							label="Job description"
							bind:value={jdText}
							rows={6}
							placeholder="Paste the JD — we’ll match your confirmed skills…"
						/>
						<label class="checkbox">
							<input type="checkbox" bind:checked={includeMatching} />
							Include matching experience &amp; projects
						</label>
					{/if}

					{#if targetMode === 'custom'}
						{#if seedingCustom}
							<p class="hint">Loading folio selection…</p>
						{:else}
							<PortfolioLibraryPicker
								{skills}
								{projects}
								{experiences}
								{educations}
								{certifications}
								{languages}
								bind:selectedSkills
								bind:selectedProjects
								bind:selectedExperience
								bind:selectedEducation
								bind:selectedCertifications
								bind:selectedLanguages
								showSectionVisibility={false}
								title="Build this resume"
								hint="Starts from the selected folio — trim or add items for contract, freelance, or full-time. Library stays unchanged."
							/>
						{/if}
					{/if}

					<button
						type="button"
						class="linkish advanced-toggle"
						on:click={() => (showAdvanced = !showAdvanced)}
					>
						{showAdvanced ? 'Hide theme' : 'Theme'}
					</button>

					{#if showAdvanced}
						<label class="field">
							<span class="label">Theme</span>
							<select bind:value={themeSlug}>
								{#each resumeThemes as t}
									<option value={t}>{t}</option>
								{/each}
							</select>
						</label>
					{/if}
				</div>

				<div class="form-actions">
					<Button disabled={saving} on:click={createNew}>
						{saving ? 'Creating…' : 'Create resume'}
					</Button>
				</div>
			{/if}
		</Card>

		{#if analysis && lastCreatedId && previewingId === lastCreatedId}
			<Card>
				<h2 class="section-title">Match analysis</h2>
				<p class="hint">
					{analysis.coverage_pct}% of confirmed skills applied · {analysis.applied_skills
						.length}/{analysis.confirmed_skill_total}
				</p>
				{#if analysis.matched_from_jd.length}
					<p class="chip-line">
						<span class="muted">From JD:</span>
						{#each analysis.matched_from_jd as sk}
							<span class="pill">{sk.name}</span>
						{/each}
					</p>
				{/if}
				{#if analysis.selected_by_user.length}
					<p class="chip-line">
						<span class="muted">You picked:</span>
						{#each analysis.selected_by_user as sk}
							<span class="pill">{sk.name}</span>
						{/each}
					</p>
				{/if}
				<ul class="attached">
					<li>{analysis.attached.projects} projects</li>
					<li>{analysis.attached.experience} experience</li>
					<li>{analysis.attached.education} education</li>
				</ul>
			</Card>
		{/if}

		{#if loading}
			<p class="muted">Loading…</p>
		{:else if items.length === 0}
			<p class="muted empty">No resumes yet — create one above.</p>
		{:else}
			<ul class="list">
				{#each items as r (r.id)}
					<li>
						<Card>
							<div class="row">
								<div>
									<h2>
										{r.name}
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
										aria-pressed={previewingId === r.id}
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
	select,
	input[type='text'],
	input[type='search'],
	.search {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		font: inherit;
		color: var(--color-text);
	}
	.hint {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.mode {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.35rem;
		padding: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.mode[aria-label='Visibility'] {
		grid-template-columns: repeat(2, 1fr);
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
	.linkish {
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
		cursor: pointer;
	}
	.linkish:hover {
		text-decoration: underline;
	}
	.advanced-toggle {
		align-self: flex-start;
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
	.chip-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
	}
	.pill {
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: var(--color-primary-light);
		border: 1px solid var(--color-primary);
		font-size: 0.75rem;
	}
	.attached {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	:global(.card + .card) {
		margin-top: 1rem;
	}
	@media (max-width: 640px) {
		.mode {
			grid-template-columns: 1fr;
		}
	}
</style>
