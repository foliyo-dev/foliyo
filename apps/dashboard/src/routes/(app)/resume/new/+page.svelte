<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PortfolioLibraryPicker from '$lib/components/portfolio/PortfolioLibraryPicker.svelte';
	import { createResume, resumeThemes, type Resume } from '$lib/api/resumes';
	import { listPortfolios, getPortfolio, type Portfolio } from '$lib/api/portfolios';
	import { listSkills, type Skill } from '$lib/api/skills';
	import { listProjects, type Project } from '$lib/api/projects';
	import { listExperience, type Experience } from '$lib/api/experience';
	import { listEducation, type Education } from '$lib/api/education';
	import { listCertifications, type Certification } from '$lib/api/certifications';
	import { listLanguages, type Language } from '$lib/api/languages';
	import { showToast } from '$lib/stores/toast';
	import { ApiError } from '$lib/api/client';

	type BuildMode = 'library' | 'folio';

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

	let name = '';
	let nameTouched = false;
	let headline = '';
	let bio = '';
	let folioId = '';
	let seedFolioId = '';
	let linkFolioId = '';
	let themeSlug: (typeof resumeThemes)[number] = 'classic';
	let isPublic = false;
	let buildMode: BuildMode = 'library';
	let showAdvanced = false;

	let selectedSkills = new Set<string>();
	let selectedProjects = new Set<string>();
	let selectedExperience = new Set<string>();
	let selectedEducation = new Set<string>();
	let selectedCertifications = new Set<string>();
	let selectedLanguages = new Set<string>();

	$: customCount =
		selectedSkills.size +
		selectedProjects.size +
		selectedExperience.size +
		selectedEducation.size +
		selectedCertifications.size +
		selectedLanguages.size;
	$: suggestedName = buildSuggestedName();
	$: if (!nameTouched) name = suggestedName;
	$: canCreateLibrary = customCount > 0;
	$: canCreateFolio = portfolios.length > 0 && Boolean(folioId);

	onMount(load);

	async function load() {
		loading = true;
		try {
			const [p, sk, pr, ex, ed, cert, lang] = await Promise.all([
				listPortfolios(),
				listSkills('confirmed'),
				listProjects(),
				listExperience(),
				listEducation(),
				listCertifications(),
				listLanguages()
			]);
			portfolios = p;
			skills = sk.filter((s) => s.status !== 'dismissed' && s.status !== 'pending');
			projects = pr;
			experiences = ex;
			educations = ed;
			certifications = cert;
			languages = lang;
			if (!folioId && portfolios[0]) folioId = portfolios[0].id;
		} catch {
			showToast('Failed to load library', 'error');
		} finally {
			loading = false;
		}
	}

	function monthYear(): string {
		return new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
	}

	function buildSuggestedName(): string {
		const when = monthYear();
		if (buildMode === 'library') {
			return customCount > 0
				? `Library · ${customCount} item(s) — ${when}`
				: `Library resume — ${when}`;
		}
		const folio = portfolios.find((p) => p.id === folioId)?.name ?? 'Folio';
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

	async function seedFromFolio(pid: string) {
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
			showToast('Could not load folio selection', 'error');
		} finally {
			seedingCustom = false;
		}
	}

	async function setBuildMode(mode: BuildMode) {
		buildMode = mode;
		if (mode === 'library') clearCustomSelection();
	}

	async function onSeedFolioChange() {
		if (buildMode === 'library') await seedFromFolio(seedFolioId);
	}

	async function createNew() {
		const finalName = (nameTouched ? name : suggestedName).trim() || suggestedName;
		if (!finalName) {
			showToast('Resume name is required', 'error');
			return;
		}
		if (buildMode === 'library' && customCount === 0) {
			showToast('Select at least one library item', 'error');
			return;
		}
		if (buildMode === 'folio' && !folioId) {
			showToast('Choose a folio to copy', 'error');
			return;
		}

		saving = true;
		try {
			const trimmedHeadline = headline.trim();
			const trimmedBio = bio.trim();
			const base = {
				name: finalName,
				theme_slug: themeSlug,
				is_public: isPublic ? 1 : 0,
				...(trimmedHeadline ? { headline: trimmedHeadline } : {}),
				...(trimmedBio ? { bio: trimmedBio } : {})
			};

			let items: Resume[];
			if (buildMode === 'library') {
				items = await createResume({
					...base,
					portfolio_id: linkFolioId || null,
					content: {
						skill_ids: [...selectedSkills],
						project_ids: [...selectedProjects],
						experience_ids: [...selectedExperience],
						education_ids: [...selectedEducation],
						certification_ids: [...selectedCertifications],
						language_ids: [...selectedLanguages]
					}
				});
				showToast(`Resume created · ${customCount} item(s)`, 'success');
			} else {
				items = await createResume({
					...base,
					portfolio_id: folioId
				});
				showToast('Resume created from folio', 'success');
			}
			const newest = items[0];
			await goto(newest ? `/resume?preview=${newest.id}` : '/resume');
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
</script>

<PageHeader
	title="New resume"
	description="Pick library items directly, or copy a whole folio. Your library and public folios stay unchanged."
/>

{#if loading}
	<p class="muted">Loading…</p>
{:else}
	<Card>
		<div class="fields">
			<div class="mode" role="group" aria-label="How to build content">
				<button
					type="button"
					class="mode-option"
					class:on={buildMode === 'library'}
					on:click={() => setBuildMode('library')}
				>
					From library
				</button>
				<button
					type="button"
					class="mode-option"
					class:on={buildMode === 'folio'}
					disabled={portfolios.length === 0}
					on:click={() => setBuildMode('folio')}
				>
					Whole folio
				</button>
			</div>

			{#if buildMode === 'folio'}
				{#if portfolios.length === 0}
					<p class="hint">
						Create a <a href="/portfolios">folio</a> first to copy one wholesale, or use
						<strong>From library</strong> instead.
					</p>
				{:else}
					<label class="field">
						<span class="label">Copy folio</span>
						<select bind:value={folioId}>
							{#each portfolios as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
						<p class="hint">Copies this folio’s library selection into a private resume snapshot.</p>
					</label>
				{/if}
			{:else}
				<label class="field">
					<span class="label">Seed from folio (optional)</span>
					<select bind:value={seedFolioId} on:change={onSeedFolioChange}>
						<option value="">Start empty</option>
						{#each portfolios as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
					<p class="hint">Pre-selects items from a folio — you can still add or remove library items.</p>
				</label>

				<label class="field">
					<span class="label">Link folio (optional)</span>
					<select bind:value={linkFolioId}>
						<option value="">None</option>
						{#each portfolios as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
					<p class="hint">Metadata only — does not change resume content.</p>
				</label>

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
						hint="Choose from your library. Foliyo stores a snapshot — library edits won’t auto-sync."
					/>
				{/if}
			{/if}

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

			<div class="summary-section">
				<h3 class="summary-title">Resume summary (optional)</h3>
				<p class="hint">
					Leave blank to fall back to linked folio, then Basics. Set here only when this resume
					needs its own headline or summary.
				</p>
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
			</div>

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
			<Button
				disabled={saving ||
					(buildMode === 'library' && !canCreateLibrary) ||
					(buildMode === 'folio' && !canCreateFolio)}
				on:click={createNew}
			>
				{saving ? 'Creating…' : 'Create resume'}
			</Button>
		</div>
	</Card>
{/if}

<style>
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
	input[type='text'] {
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
	.mode-option:disabled {
		opacity: 0.45;
		cursor: not-allowed;
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
</style>
