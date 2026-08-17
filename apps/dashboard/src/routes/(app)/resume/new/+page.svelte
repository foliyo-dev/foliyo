<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
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

	type BuildMode = 'portfolio' | 'custom';

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
	let portfolioId = '';
	let themeSlug: (typeof resumeThemes)[number] = 'classic';
	let isPublic = false;
	let buildMode: BuildMode = 'portfolio';
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
			if (!portfolioId && portfolios[0]) portfolioId = portfolios[0].id;
			name = buildSuggestedName();
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
		const folio = portfolios.find((p) => p.id === portfolioId)?.name ?? 'Resume';
		const when = monthYear();
		if (buildMode === 'custom') {
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

	async function setBuildMode(mode: BuildMode) {
		buildMode = mode;
		if (mode === 'portfolio') clearCustomSelection();
		if (mode === 'custom') await seedCustomFromPortfolio(portfolioId);
	}

	async function onPortfolioChange() {
		if (buildMode === 'custom') await seedCustomFromPortfolio(portfolioId);
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
		if (buildMode === 'custom' && customCount === 0) {
			showToast('Select at least one library item', 'error');
			return;
		}

		saving = true;
		try {
			let items: Resume[];
			if (buildMode === 'custom') {
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
				showToast(`Custom resume created · ${customCount} item(s)`, 'success');
			} else {
				items = await createResume({
					name: finalName,
					portfolio_id: portfolioId,
					theme_slug: themeSlug,
					is_public: isPublic ? 1 : 0
				});
				showToast('Resume created', 'success');
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
	title="From folio"
	description="Copy a whole folio into a resume, or pick items by hand. Your public folio stays unchanged."
/>

{#if loading}
	<p class="muted">Loading…</p>
{:else if portfolios.length === 0}
	<Card>
		<p class="muted">
			Create a <a href="/portfolios">portfolio</a> first — we’ll seed your resume from it.
		</p>
	</Card>
{:else}
	<Card>
		<div class="fields">
			<label class="field">
				<span class="label">From portfolio</span>
				<select bind:value={portfolioId} on:change={() => onPortfolioChange()}>
					{#each portfolios as p}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
				<p class="hint">Copies this folio’s content into a private resume snapshot.</p>
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
					class:on={buildMode === 'portfolio'}
					on:click={() => setBuildMode('portfolio')}
				>
					Whole folio
				</button>
				<button
					type="button"
					class="mode-option"
					class:on={buildMode === 'custom'}
					on:click={() => setBuildMode('custom')}
				>
					Custom
				</button>
			</div>

			{#if buildMode === 'custom'}
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
						hint="Starts from the selected folio — trim or add items. Library stays unchanged."
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
