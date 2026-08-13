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
		portfolioPrivateUrl,
		generatePortfolioAccessToken,
		revokePortfolioAccessToken,
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
	import { listResumes, type Resume } from '$lib/api/resumes';
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
	let skillsTitle = '';
	let projectsTitle = '';
	let experienceTitle = '';
	let educationTitle = '';
	let certificationsTitle = '';
	let languagesTitle = '';
	let slugTouched = false;
	let resumeId: string | null = null;
	let accessToken: string | null = null;
	let tokenBusy = false;

	let skills: Skill[] = [];
	let projects: Project[] = [];
	let experiences: Experience[] = [];
	let educations: Education[] = [];
	let certifications: Certification[] = [];
	let languages: Language[] = [];
	let resumes: Resume[] = [];

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
				skills_title: skillsTitle,
				projects_title: projectsTitle,
				experience_title: experienceTitle,
				education_title: educationTitle,
				certifications_title: certificationsTitle,
				languages_title: languagesTitle,
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
			const [p, sk, pr, ex, ed, certs, langs, res] = await Promise.all([
				getPortfolio(portfolioId),
				listSkills('confirmed'),
				listProjects(),
				listExperience(),
				listEducation(),
				listCertifications(),
				listLanguages(),
				listResumes()
			]);
			portfolio = p;
			skills = sk;
			projects = pr;
			experiences = ex;
			educations = ed;
			certifications = certs;
			languages = langs;
			resumes = res;
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
		skillsTitle = p.skills_title ?? '';
		projectsTitle = p.projects_title ?? '';
		experienceTitle = p.experience_title ?? '';
		educationTitle = p.education_title ?? '';
		certificationsTitle = p.certifications_title ?? '';
		languagesTitle = p.languages_title ?? '';
		resumeId = p.resume_id ?? null;
		accessToken = p.access_token ?? null;
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
				skills_title: skillsTitle,
				projects_title: projectsTitle,
				experience_title: experienceTitle,
				education_title: educationTitle,
				certifications_title: certificationsTitle,
				languages_title: languagesTitle,
				sort_order: portfolio.sort_order ?? 0,
				resume_id: resumeId
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

	$: linkedResume = resumeId ? (resumes.find((r) => r.id === resumeId) ?? null) : null;
	$: privateUrl = accessToken ? portfolioPrivateUrl(accessToken) : null;

	async function generateLink() {
		if (!portfolio) return;
		tokenBusy = true;
		try {
			const res = await generatePortfolioAccessToken(portfolio.id);
			accessToken = res.access_token;
			showToast('Private link created', 'success');
		} catch {
			showToast('Failed to create private link', 'error');
		} finally {
			tokenBusy = false;
		}
	}

	async function revokeLink() {
		if (!portfolio) return;
		tokenBusy = true;
		try {
			await revokePortfolioAccessToken(portfolio.id);
			accessToken = null;
			showToast('Private link revoked', 'success');
		} catch {
			showToast('Failed to revoke private link', 'error');
		} finally {
			tokenBusy = false;
		}
	}

	async function copyLink(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			showToast('Link copied', 'success');
		} catch {
			showToast('Could not copy link', 'error');
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
				<summary>Sharing</summary>
				<div class="fields">
					<label class="field">
						<span class="label">Download resume button</span>
						<select bind:value={resumeId}>
							<option value={null}>None</option>
							{#each resumes as r (r.id)}
								<option value={r.id}>{r.name}</option>
							{/each}
						</select>
						<span class="hint">
							{#if linkedResume && linkedResume.is_public !== 1}
								“{linkedResume.name}” is private — mark it public on the Resumes page for the
								button to appear on this portfolio.
							{:else if resumeId}
								Adds a “Download resume” button linking to this resume’s share page.
							{:else}
								Optional — visitors can download a linked, public resume as PDF.
							{/if}
						</span>
					</label>

					<div class="field">
						<span class="label">Private link</span>
						{#if privateUrl}
							<div class="link-row">
								<code class="link-code">{privateUrl}</code>
								<Button variant="ghost" on:click={() => copyLink(privateUrl ?? '')}>Copy</Button>
								<Button variant="ghost" disabled={tokenBusy} on:click={generateLink}
									>Regenerate</Button
								>
								<Button variant="ghost" disabled={tokenBusy} on:click={revokeLink}
									>Revoke</Button
								>
							</div>
							<span class="hint"
								>Anyone with this link can view the portfolio, even while private —
								regenerating breaks the old link.</span
							>
						{:else}
							<Button variant="ghost" disabled={tokenBusy} on:click={generateLink}
								>{tokenBusy ? 'Creating…' : 'Create private link'}</Button
							>
							<span class="hint"
								>Share this portfolio with one person (e.g. a client) without publishing it or
								making it guessable at /u/{$user?.handle ?? 'you'}.</span
							>
						{/if}
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
					bind:skillsTitle
					bind:projectsTitle
					bind:experienceTitle
					bind:educationTitle
					bind:certificationsTitle
					bind:languagesTitle
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
	.hint {
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.link-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.link-code {
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		padding: 0.35rem 0.6rem;
		background: var(--color-bg, #f8fafc);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		word-break: break-all;
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
