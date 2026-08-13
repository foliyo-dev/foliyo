<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PortfolioLibraryPicker from '$lib/components/portfolio/PortfolioLibraryPicker.svelte';
	import EditorWithPortfolioPreview from '$lib/components/preview/EditorWithPortfolioPreview.svelte';
	import {
		getPortfolio,
		updatePortfolio,
		updatePortfolioContent,
		deletePortfolio,
		setDefaultPortfolio,
		slugify,
		portfolioThemes,
		portfolioPublicUrl,
		type PortfolioDetail
	} from '$lib/api/portfolios';
	import type { PortfolioDraftPreview } from '$lib/api/preview';
	import { user } from '$lib/stores/auth';
	import { listSkills, type Skill } from '$lib/api/skills';
	import { listProjects, type Project } from '$lib/api/projects';
	import { listExperience, type Experience } from '$lib/api/experience';
	import { listEducation, type Education } from '$lib/api/education';
	import { listCertifications, type Certification } from '$lib/api/certifications';
	import { listLanguages, type Language } from '$lib/api/languages';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let loading = true;
	let saving = false;
	let portfolio: PortfolioDetail | null = null;

	let name = '';
	let slug = '';
	let description = '';
	let headline = '';
	let bio = '';
	let themeSlug = 'minimal';
	let isPublic = false;
	let isDefault = false;
	let showSkills = true;
	let showProjects = true;
	let showExperience = true;
	let showEducation = true;
	let showCertifications = true;
	let showLanguages = true;
	let slugTouched = false;

	let skills: Skill[] = [];
	let projects: Project[] = [];
	let experiences: Experience[] = [];
	let educations: Education[] = [];
	let certifications: Certification[] = [];
	let languages: Language[] = [];

	let selectedSkills = new Set<string>();
	let selectedProjects = new Set<string>();
	let selectedExperience = new Set<string>();
	let selectedEducation = new Set<string>();
	let selectedCertifications = new Set<string>();
	let selectedLanguages = new Set<string>();

	$: portfolioId = $page.params.id;

	$: draft = (loading
		? null
		: {
				name: name.trim() || 'Portfolio',
				description,
				headline,
				bio,
				theme_slug: themeSlug,
				show_skills: showSkills ? 1 : 0,
				show_projects: showProjects ? 1 : 0,
				show_experience: showExperience ? 1 : 0,
				show_education: showEducation ? 1 : 0,
				show_certifications: showCertifications ? 1 : 0,
				show_languages: showLanguages ? 1 : 0,
				skill_ids: [...selectedSkills],
				project_ids: [...selectedProjects],
				experience_ids: [...selectedExperience],
				education_ids: [...selectedEducation],
				certification_ids: [...selectedCertifications],
				language_ids: [...selectedLanguages]
			}) satisfies PortfolioDraftPreview | null;

	$: liveUrl =
		isPublic && $user?.handle
			? portfolioPublicUrl($user.handle, {
					slug,
					is_public: 1,
					is_default: isDefault ? 1 : 0
				})
			: null;

	onMount(load);

	async function load() {
		if (!portfolioId) {
			goto('/portfolios');
			return;
		}
		loading = true;
		try {
			const [p, sk, pr, ex, ed, certs, langs] = await Promise.all([
				getPortfolio(portfolioId),
				listSkills('confirmed'),
				listProjects(),
				listExperience(),
				listEducation(),
				listCertifications(),
				listLanguages()
			]);
			portfolio = p;
			skills = sk;
			projects = pr;
			experiences = ex;
			educations = ed;
			certifications = certs;
			languages = langs;
			fillForm(p);
		} catch {
			showToast('Portfolio not found', 'error');
			goto('/portfolios');
		} finally {
			loading = false;
		}
	}

	function fillForm(p: PortfolioDetail) {
		name = p.name;
		slug = p.slug;
		description = p.description;
		headline = p.headline ?? '';
		bio = p.bio ?? '';
		themeSlug = p.theme_slug;
		isPublic = p.is_public === 1;
		isDefault = p.is_default === 1;
		showSkills = p.show_skills === 1;
		showProjects = p.show_projects === 1;
		showExperience = p.show_experience === 1;
		showEducation = p.show_education === 1;
		showCertifications = (p.show_certifications ?? 1) === 1;
		showLanguages = (p.show_languages ?? 1) === 1;
		slugTouched = true;
		selectedSkills = new Set(p.content.skill_ids);
		selectedProjects = new Set(p.content.project_ids);
		selectedExperience = new Set(p.content.experience_ids);
		selectedEducation = new Set(p.content.education_ids);
		selectedCertifications = new Set(p.content.certification_ids ?? []);
		selectedLanguages = new Set(p.content.language_ids ?? []);
	}

	$: if (!slugTouched && name) slug = slugify(name);

	async function save() {
		if (!portfolio || !name.trim() || !slug.trim()) return;
		saving = true;
		try {
			await updatePortfolio(portfolio.id, {
				name: name.trim(),
				slug: slug.trim(),
				description,
				headline,
				bio,
				theme_slug: themeSlug,
				is_public: isPublic ? 1 : 0,
				is_default: isDefault ? 1 : 0,
				show_skills: showSkills ? 1 : 0,
				show_projects: showProjects ? 1 : 0,
				show_experience: showExperience ? 1 : 0,
				show_education: showEducation ? 1 : 0,
				show_certifications: showCertifications ? 1 : 0,
				show_languages: showLanguages ? 1 : 0,
				sort_order: portfolio.sort_order ?? 0
			});
			if (isDefault) await setDefaultPortfolio(portfolio.id);
			await updatePortfolioContent(portfolio.id, {
				skill_ids: [...selectedSkills],
				project_ids: [...selectedProjects],
				experience_ids: [...selectedExperience],
				education_ids: [...selectedEducation],
				certification_ids: [...selectedCertifications],
				language_ids: [...selectedLanguages]
			});
			showToast('Portfolio saved', 'success');
			await load();
		} catch {
			showToast('Failed to save portfolio', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!portfolio) return;
		if (!(await confirmDelete(portfolio.name?.trim() || 'this portfolio'))) return;
		try {
			await deletePortfolio(portfolio.id);
			showToast('Portfolio deleted', 'success');
			goto('/portfolios');
		} catch {
			showToast('Failed to delete portfolio', 'error');
		}
	}
</script>

{#if loading}
	<p class="muted">Loading…</p>
{:else if portfolio}
	<PageHeader
		title={portfolio.name}
		description="Select library content, set headline/bio overrides, theme, and publish."
	/>

	{#if isPublic && liveUrl}
		<p class="url-banner">
			Live at
			<a href={liveUrl} target="_blank" rel="noreferrer">{liveUrl}</a>
		</p>
	{:else}
		<p class="url-banner muted">
			Private — turn on publish below to go live. Preview still works on the right.
		</p>
	{/if}

	<EditorWithPortfolioPreview
		portfolioId={portfolio.id}
		{draft}
		portfolioName={name.trim() || portfolio.name}
		{liveUrl}
	>
		<Card>
			<details class="block" open>
				<summary>Details &amp; identity</summary>
				<div class="fields">
					<Input label="Name" bind:value={name} />
					<Input label="Slug" bind:value={slug} on:input={() => (slugTouched = true)} />
					<Textarea label="Short description" bind:value={description} rows={2} />
					<Input
						label="Headline (optional override)"
						bind:value={headline}
						placeholder="Falls back to Basics if empty"
					/>
					<Textarea
						label="Bio (optional override)"
						bind:value={bio}
						rows={4}
						placeholder="Falls back to Basics if empty"
					/>
					<label class="field">
						<span class="label">Theme</span>
						<select bind:value={themeSlug}>
							{#each portfolioThemes as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</label>
					<div class="toggles">
						<label class="checkbox"
							><input type="checkbox" bind:checked={isPublic} /> Publish publicly</label
						>
						<label class="checkbox"
							><input type="checkbox" bind:checked={isDefault} /> Default portfolio</label
						>
					</div>
				</div>
			</details>
		</Card>

		<Card>
			<details class="block" open>
				<summary>
					Library content
					<span class="step-meta"
						>{selectedSkills.size +
							selectedProjects.size +
							selectedExperience.size +
							selectedEducation.size +
							selectedCertifications.size +
							selectedLanguages.size} selected</span
					>
				</summary>
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
					bind:showSkills
					bind:showProjects
					bind:showExperience
					bind:showEducation
					bind:showCertifications
					bind:showLanguages
				/>
			</details>
		</Card>

		<div class="actions sticky">
			<Button disabled={saving} on:click={save}>{saving ? 'Saving…' : 'Save portfolio'}</Button>
			<Button variant="ghost" on:click={() => goto('/portfolios')}>Back</Button>
			<Button variant="ghost" on:click={remove}>Delete</Button>
		</div>
	</EditorWithPortfolioPreview>
{/if}

<style>
	.muted {
		color: var(--color-muted);
	}
	.url-banner {
		margin: 0 0 1rem;
		font-size: 0.875rem;
	}
	.block {
		margin: 0;
	}
	.block summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 1rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 0;
	}
	.block[open] summary {
		margin-bottom: 1rem;
	}
	.step-meta {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-muted);
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
	.toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.actions.sticky {
		position: sticky;
		bottom: 0;
		z-index: 5;
		margin-top: 1.25rem;
		padding: 0.75rem 0;
		background: linear-gradient(
			to top,
			var(--color-bg, #f8fafc) 70%,
			color-mix(in srgb, var(--color-bg, #f8fafc) 0%, transparent)
		);
	}
	:global(.card + .card) {
		margin-top: 1rem;
	}
</style>
