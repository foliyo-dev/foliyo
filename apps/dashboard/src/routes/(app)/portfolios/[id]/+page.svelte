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
	import FolioSummaryAssist from '$lib/components/portfolio/FolioSummaryAssist.svelte';
	import ThemeLayoutPanel from '$lib/components/portfolio/ThemeLayoutPanel.svelte';
	import StorytellingPanel from '$lib/components/portfolio/StorytellingPanel.svelte';
	import EditorWithPortfolioPreview from '$lib/components/preview/EditorWithPortfolioPreview.svelte';
	import {
		getPortfolio,
		updatePortfolio,
		updatePortfolioContent,
		deletePortfolio,
		setDefaultPortfolio,
		slugify,
		parsePortfolioThemeConfig,
		portfolioPublicUrl,
		portfolioPrivateUrl,
		generatePortfolioAccessToken,
		revokePortfolioAccessToken,
		type PortfolioDetail,
		type ThemeConfig
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
	import { getProfile, type Profile } from '$lib/api/profile';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let loading = true;
	let saving = false;
	let portfolio: PortfolioDetail | null = null;
	let profile: Profile | null = null;

	let name = '';
	let slug = '';
	let headline = '';
	let bio = '';
	let customSummaryOpen = false;
	let themeSlug = 'minimal';
	let themeConfig: ThemeConfig | null = null;
	let isPublic = false;
	let isDefault = false;
	let showSkills = true;
	let showProjects = true;
	let showExperience = true;
	let showEducation = true;
	let showCertifications = true;
	let showLanguages = true;
	let showPosts = true;
	let showSkillLevels = false;
	let projectsLayout: 'cards' | 'featured_timeline' | 'timeline' = 'cards';
	let heroCtaPrimary = '';
	let heroCtaSecondary = '';
	let skillsTitle = '';
	let projectsTitle = '';
	let experienceTitle = '';
	let educationTitle = '';
	let certificationsTitle = '';
	let languagesTitle = '';
	let postsTitle = '';
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

	$: selectedSummary = [
		selectedProjects.size ? `${selectedProjects.size} project${selectedProjects.size === 1 ? '' : 's'}` : null,
		selectedExperience.size
			? `${selectedExperience.size} role${selectedExperience.size === 1 ? '' : 's'}`
			: null,
		selectedSkills.size ? `${selectedSkills.size} skill${selectedSkills.size === 1 ? '' : 's'}` : null,
		selectedEducation.size ? `${selectedEducation.size} education` : null,
		selectedCertifications.size
			? `${selectedCertifications.size} cert${selectedCertifications.size === 1 ? '' : 's'}`
			: null,
		selectedLanguages.size
			? `${selectedLanguages.size} language${selectedLanguages.size === 1 ? '' : 's'}`
			: null,
		showPosts ? 'Writing on' : null
	]
		.filter(Boolean)
		.join(' · ') || 'Nothing selected yet';

	$: portfolioId = $page.params.id;
	$: hasOwnSummary = Boolean(headline.trim() || bio.trim());

	$: draft = (loading
		? null
		: {
				name: name.trim() || 'Portfolio',
				description: '',
				headline: customSummaryOpen || hasOwnSummary ? headline : '',
				bio: customSummaryOpen || hasOwnSummary ? bio : '',
				theme_slug: themeSlug,
				theme_config: themeConfig,
				show_skills: showSkills ? 1 : 0,
				show_projects: showProjects ? 1 : 0,
				show_experience: showExperience ? 1 : 0,
				show_education: showEducation ? 1 : 0,
				show_certifications: showCertifications ? 1 : 0,
				show_languages: showLanguages ? 1 : 0,
				show_posts: showPosts ? 1 : 0,
				show_skill_levels: showSkillLevels ? 1 : 0,
				projects_layout: projectsLayout,
				hero_cta_primary: heroCtaPrimary,
				hero_cta_secondary: heroCtaSecondary,
				skills_title: skillsTitle,
				projects_title: projectsTitle,
				experience_title: experienceTitle,
				education_title: educationTitle,
				certifications_title: certificationsTitle,
				languages_title: languagesTitle,
				posts_title: postsTitle,
				skill_ids: [...selectedSkills],
				project_ids: [...selectedProjects],
				experience_ids: [...selectedExperience],
				education_ids: [...selectedEducation],
				certification_ids: [...selectedCertifications],
				language_ids: [...selectedLanguages],
				post_ids: []
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
			const [p, sk, pr, ex, ed, certs, langs, res, prof] = await Promise.all([
				getPortfolio(portfolioId),
				listSkills('confirmed'),
				listProjects(),
				listExperience(),
				listEducation(),
				listCertifications(),
				listLanguages(),
				listResumes(),
				getProfile().catch(() => null)
			]);
			portfolio = p;
			profile = prof;
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
		headline = p.headline ?? '';
		bio = p.bio ?? '';
		customSummaryOpen = Boolean(String(p.headline ?? '').trim() || String(p.bio ?? '').trim());
		themeSlug = p.theme_slug;
		themeConfig = parsePortfolioThemeConfig(p.theme_config);
		isPublic = p.is_public === 1;
		isDefault = p.is_default === 1;
		showSkills = p.show_skills === 1;
		showProjects = p.show_projects === 1;
		showExperience = p.show_experience === 1;
		showEducation = p.show_education === 1;
		showCertifications = (p.show_certifications ?? 1) === 1;
		showLanguages = (p.show_languages ?? 1) === 1;
		showPosts = (p.show_posts ?? 1) === 1;
		showSkillLevels = (p.show_skill_levels ?? 0) === 1;
		projectsLayout =
			p.projects_layout === 'featured_timeline' || p.projects_layout === 'timeline'
				? p.projects_layout
				: 'cards';
		heroCtaPrimary = p.hero_cta_primary ?? '';
		heroCtaSecondary = p.hero_cta_secondary ?? '';
		skillsTitle = p.skills_title ?? '';
		projectsTitle = p.projects_title ?? '';
		experienceTitle = p.experience_title ?? '';
		educationTitle = p.education_title ?? '';
		certificationsTitle = p.certifications_title ?? '';
		languagesTitle = p.languages_title ?? '';
		postsTitle = p.posts_title ?? '';
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

	function openCustomSummary() {
		customSummaryOpen = true;
	}

	function useBasicsSummary() {
		headline = '';
		bio = '';
		customSummaryOpen = false;
	}

	function setSummaryMode(mode: 'basics' | 'custom') {
		if (mode === 'basics') useBasicsSummary();
		else openCustomSummary();
	}

	function truncateText(value: string | null | undefined, max = 120): string {
		const t = String(value ?? '').trim();
		if (!t) return '';
		return t.length > max ? `${t.slice(0, max - 1)}…` : t;
	}

	$: urlPathHint = isDefault
		? `/u/${$user?.handle ?? 'you'}`
		: `/u/${$user?.handle ?? 'you'}/${slug.trim() || '…'}`;

	$: basicsHeadlinePreview = truncateText(profile?.headline, 80);
	$: basicsBioPreview = truncateText(profile?.bio, 140);

	function applyDeveloperPreset() {
		projectsLayout = 'featured_timeline';
		showSkillLevels = false;
		showProjects = true;
		showSkills = true;
		showExperience = true;
		showEducation = false;
		showCertifications = false;
		showLanguages = false;
		showPosts = true;
		heroCtaPrimary = 'View work';
		heroCtaSecondary = 'Contact';
		selectedProjects = new Set(projects.map((p) => p.id));
		selectedExperience = new Set(experiences.map((e) => e.id));
		selectedSkills = new Set(skills.map((s) => s.id));
		selectedEducation = new Set();
		selectedCertifications = new Set();
		selectedLanguages = new Set();
		showToast('Developer site preset applied — save to publish', 'success');
	}

	async function save() {
		if (!portfolio || !name.trim() || !slug.trim()) return;
		saving = true;
		try {
			await updatePortfolio(portfolio.id, {
				name: name.trim(),
				slug: slug.trim(),
				description: '',
				headline: headline.trim(),
				bio: bio.trim(),
				theme_slug: themeSlug,
				theme_config: themeConfig,
				is_public: isPublic ? 1 : 0,
				is_default: isDefault ? 1 : 0,
				show_skills: showSkills ? 1 : 0,
				show_projects: showProjects ? 1 : 0,
				show_experience: showExperience ? 1 : 0,
				show_education: showEducation ? 1 : 0,
				show_certifications: showCertifications ? 1 : 0,
				show_languages: showLanguages ? 1 : 0,
				show_posts: showPosts ? 1 : 0,
				show_skill_levels: showSkillLevels ? 1 : 0,
				projects_layout: projectsLayout,
				hero_cta_primary: heroCtaPrimary,
				hero_cta_secondary: heroCtaSecondary,
				skills_title: skillsTitle,
				projects_title: projectsTitle,
				experience_title: experienceTitle,
				education_title: educationTitle,
				certifications_title: certificationsTitle,
				languages_title: languagesTitle,
				posts_title: postsTitle,
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
				language_ids: [...selectedLanguages],
				post_ids: []
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
	<EditorWithPortfolioPreview
		portfolioId={portfolio.id}
		{draft}
		portfolioName={name.trim() || portfolio.name}
		{liveUrl}
	>
		<PageHeader
			title={portfolio.name}
			description="Choose what visitors will see, theme, and publish."
		>
			{#snippet actions()}
				<span class="status-chip" class:published={isPublic}>
					{isPublic ? 'Public' : 'Private'}
				</span>
				{#if isPublic && liveUrl}
					<Button
						variant="ghost"
						size="sm"
						on:click={() => window.open(liveUrl, '_blank', 'noopener,noreferrer')}
					>
						Open live
					</Button>
				{/if}
				<Button size="sm" disabled={saving} on:click={save}>{saving ? 'Saving…' : 'Save'}</Button>
			{/snippet}
		</PageHeader>

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

		<Card variant="panel">
			<div class="card-head">
				<span class="card-icon" aria-hidden="true">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></svg
					>
				</span>
				<h2 class="card-title">Identity</h2>
			</div>
			<div class="fields">
				<div class="row">
					<Input label="Name" bind:value={name} />
					<div class="slug-field">
						<Input label="Slug" bind:value={slug} on:input={() => (slugTouched = true)} />
						<p class="url-hint">{urlPathHint}</p>
					</div>
				</div>

				<div class="summary-section">
					<div class="summary-head">
						<h3 class="summary-title">Folio summary</h3>
						<div class="seg" role="tablist" aria-label="Folio summary source">
							<button
								type="button"
								class="seg-btn"
								class:active={!customSummaryOpen}
								role="tab"
								aria-selected={!customSummaryOpen}
								on:click={() => setSummaryMode('basics')}
							>
								Use Basics
							</button>
							<button
								type="button"
								class="seg-btn"
								class:active={customSummaryOpen}
								role="tab"
								aria-selected={customSummaryOpen}
								on:click={() => setSummaryMode('custom')}
							>
								Custom for this folio
							</button>
						</div>
					</div>

					{#if !customSummaryOpen}
						<div class="basics-preview">
							{#if basicsHeadlinePreview || basicsBioPreview}
								{#if basicsHeadlinePreview}
									<p class="preview-headline">{basicsHeadlinePreview}</p>
								{/if}
								{#if basicsBioPreview}
									<p class="preview-bio">{basicsBioPreview}</p>
								{/if}
							{:else}
								<p class="summary-using">No Basics headline or summary yet.</p>
							{/if}
							<a class="summary-link" href="/basics">Edit Basics</a>
						</div>
					{:else}
						<div class="custom-summary">
							<FolioSummaryAssist
								bind:headline
								bind:bio
								skillIds={[...selectedSkills]}
								projectIds={[...selectedProjects]}
								experienceIds={[...selectedExperience]}
								educationIds={[...selectedEducation]}
							/>
							<Input
								label="Headline"
								bind:value={headline}
								placeholder="e.g. Backend engineer · open to contract"
							/>
							<Textarea
								label="Professional summary"
								bind:value={bio}
								rows={4}
								placeholder="Short summary for this folio…"
							/>
						</div>
					{/if}
				</div>
			</div>
		</Card>

		<Card variant="panel">
			<div class="card-head">
				<span class="card-icon" aria-hidden="true">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg
					>
				</span>
				<h2 class="card-title">Look</h2>
			</div>
			<div class="fields">
				<ThemeLayoutPanel bind:themeSlug bind:themeConfig portfolioId={portfolio?.id} />
				<StorytellingPanel
					bind:projectsLayout
					bind:showSkillLevels
					bind:heroCtaPrimary
					bind:heroCtaSecondary
					showPreset
					onApplyDeveloperPreset={applyDeveloperPreset}
				/>
			</div>
		</Card>

		<Card variant="panel">
			<div class="card-head">
				<span class="card-icon" aria-hidden="true">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle
							cx="18"
							cy="19"
							r="2.5"
						/><path d="M8.5 10.5 15.5 6.5M8.5 13.5l7 4" /></svg
					>
				</span>
				<h2 class="card-title">Share</h2>
			</div>
			<div class="share-body">
				<label class="share-item share-resume">
					<span class="label">Resume download</span>
					<select class="resume-select" bind:value={resumeId}>
						<option value={null}>None</option>
						{#each resumes as r (r.id)}
							<option value={r.id}>{r.name}</option>
						{/each}
					</select>
					{#if linkedResume && linkedResume.is_public !== 1}
						<span class="hint"
							>“{linkedResume.name}” is private — mark public on
							<a href="/resume">Resumes</a>.</span
						>
					{:else}
						<span class="hint">Optional. Manage on <a href="/resume">Resumes</a>.</span>
					{/if}
				</label>
				<div class="share-item share-link">
					<span class="label">Private link</span>
					{#if privateUrl}
						<div class="link-row">
							<code class="link-code">{privateUrl}</code>
							<Button variant="ghost" size="sm" on:click={() => copyLink(privateUrl ?? '')}
								>Copy</Button
							>
							<Button variant="ghost" size="sm" disabled={tokenBusy} on:click={generateLink}
								>Regen</Button
							>
							<Button variant="ghost" size="sm" disabled={tokenBusy} on:click={revokeLink}
								>Revoke</Button
							>
						</div>
					{:else}
						<Button variant="ghost" size="sm" disabled={tokenBusy} on:click={generateLink}
							>{tokenBusy ? 'Creating…' : 'Create private link'}</Button
						>
					{/if}
				</div>
			</div>
		</Card>

		<Card variant="panel">
			<div class="card-head">
				<span class="card-icon" aria-hidden="true">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><path d="M4 6h16M4 12h10M4 18h14" /></svg
					>
				</span>
				<h2 class="card-title">Content</h2>
				<span class="step-meta">{selectedSummary}</span>
			</div>
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
				bind:showPosts
				bind:skillsTitle
				bind:projectsTitle
				bind:experienceTitle
				bind:educationTitle
				bind:certificationsTitle
				bind:languagesTitle
				bind:postsTitle
				title="Choose what visitors will see"
				hint="Turn sections on or off, then pick items. Writing is an on/off link to your Blog — manage posts there."
			/>
		</Card>

		<div class="actions sticky" role="region" aria-label="Portfolio actions">
			<div class="dock">
				<div class="dock-status" aria-live="polite">
					<span class="status-chip" class:live={isPublic} class:private={!isPublic}>
						<span class="status-dot" aria-hidden="true"></span>
						{isPublic ? 'Public' : 'Private'}
					</span>
					{#if isDefault}
						<span class="status-chip default">Default</span>
					{/if}
				</div>

				<div class="dock-toggles" role="group" aria-label="Publishing">
					<label class="dock-switch" title="Publish this portfolio at your public URL">
						<input type="checkbox" bind:checked={isPublic} aria-label="Publish publicly" />
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
						<span class="switch-label">Publish</span>
					</label>
					<label class="dock-switch" title="Show this portfolio at /u/your-handle">
						<input type="checkbox" bind:checked={isDefault} aria-label="Default portfolio" />
						<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
						<span class="switch-label">Default</span>
					</label>
				</div>

				<div class="dock-actions">
					<button type="button" class="dock-danger" on:click={remove}>Delete</button>
					<Button variant="ghost" size="sm" on:click={() => goto('/portfolios')}>Back</Button>
					<Button disabled={saving} on:click={save}>{saving ? 'Saving…' : 'Save'}</Button>
				</div>
			</div>
		</div>
	</EditorWithPortfolioPreview>
{/if}

<style>
	.muted {
		color: var(--color-muted);
	}
	.url-banner {
		margin: 0 0 var(--space-3);
		font-size: 0.8125rem;
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.card-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-muted);
		flex-shrink: 0;
	}
	.card-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.step-meta {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-muted);
		margin-left: auto;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		align-items: start;
	}
	.slug-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.url-hint {
		margin: 0;
		font-size: 0.75rem;
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
		line-height: 1.35;
	}
	.summary-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.summary-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.summary-title {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.seg {
		display: inline-flex;
		padding: 0.15rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		gap: 0.15rem;
	}
	.seg-btn {
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.35rem 0.65rem;
		border-radius: calc(var(--radius) - 2px);
		cursor: pointer;
		line-height: 1.2;
	}
	.seg-btn.active {
		background: var(--color-bg);
		color: var(--color-text, inherit);
		box-shadow: var(--shadow-xs);
	}
	.seg-btn:hover:not(.active) {
		color: var(--color-text, inherit);
	}
	.basics-preview,
	.custom-summary {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.preview-headline {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.35;
	}
	.preview-bio {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.summary-using {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.summary-link {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-primary);
		text-decoration: none;
		align-self: flex-start;
	}
	.summary-link:hover {
		text-decoration: underline;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 500;
	}
	select {
		min-height: var(--control-height);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}
	.hint {
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.hint a {
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: none;
	}
	.hint a:hover {
		text-decoration: underline;
	}
	.share-body {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-3) var(--space-4);
	}
	.share-item {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}
	.share-resume {
		flex: 0 0 auto;
		width: min(14rem, 100%);
	}
	.share-link {
		flex: 1 1 16rem;
		min-width: 0;
	}
	.resume-select {
		width: 100%;
		max-width: 14rem;
	}
	.link-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.link-code {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		padding: var(--space-1) var(--space-2);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		word-break: break-all;
		flex: 1;
		min-width: 0;
	}
	.actions.sticky {
		position: sticky;
		bottom: 0;
		z-index: 8;
		margin-top: var(--space-4);
		padding: var(--space-3) 0 0.35rem;
		background: linear-gradient(
			to top,
			var(--color-bg) 55%,
			color-mix(in srgb, var(--color-bg) 0%, transparent)
		);
	}
	.dock {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: calc(var(--radius) + 4px);
		background: color-mix(in srgb, var(--color-surface) 88%, transparent);
		backdrop-filter: blur(10px);
		box-shadow: 0 -4px 24px color-mix(in srgb, var(--color-text) 6%, transparent);
	}
	.dock-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.status-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 650;
		border: 1px solid var(--color-border);
		background: var(--color-bg, var(--color-surface));
		color: var(--color-muted);
	}
	.status-chip.live {
		color: color-mix(in srgb, #15803d 80%, var(--color-text));
		border-color: color-mix(in srgb, #15803d 35%, var(--color-border));
		background: color-mix(in srgb, #15803d 10%, var(--color-surface));
	}
	.status-chip.private {
		color: var(--color-muted);
	}
	.status-chip.default {
		color: var(--color-primary);
		border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
		background: color-mix(in srgb, var(--color-primary-light) 70%, var(--color-surface));
	}
	.status-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: currentColor;
	}
	.status-chip.live .status-dot {
		box-shadow: 0 0 0 3px color-mix(in srgb, #15803d 22%, transparent);
	}
	.dock-toggles {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem 0.85rem;
		margin-right: auto;
	}
	.dock-switch {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text);
	}
	.dock-switch input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
		pointer-events: none;
	}
	.switch-track {
		position: relative;
		width: 2.1rem;
		height: 1.2rem;
		border-radius: 999px;
		background: var(--color-border);
		transition: background 0.15s ease;
		flex-shrink: 0;
	}
	.switch-thumb {
		position: absolute;
		top: 0.15rem;
		left: 0.15rem;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
		transition: transform 0.15s ease;
	}
	.dock-switch input:checked + .switch-track {
		background: var(--color-primary);
	}
	.dock-switch input:checked + .switch-track .switch-thumb {
		transform: translateX(0.9rem);
	}
	.dock-switch input:focus-visible + .switch-track {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.switch-label {
		white-space: nowrap;
	}
	.dock-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		margin-left: auto;
	}
	.dock-danger {
		border: 0;
		background: transparent;
		padding: 0.35rem 0.55rem;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: var(--radius);
	}
	.dock-danger:hover {
		color: #b91c1c;
		background: color-mix(in srgb, #b91c1c 8%, transparent);
	}
	:global(.card + .card) {
		margin-top: var(--space-3);
	}
	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
		}
		.summary-head {
			flex-direction: column;
			align-items: stretch;
		}
		.seg {
			width: 100%;
		}
		.seg-btn {
			flex: 1;
			text-align: center;
		}
		.dock {
			flex-direction: column;
			align-items: stretch;
		}
		.dock-toggles,
		.dock-actions {
			margin: 0;
			width: 100%;
			justify-content: space-between;
		}
		.dock-actions :global(button.primary) {
			flex: 1;
		}
		.share-resume,
		.resume-select {
			width: 100%;
			max-width: none;
		}
	}
</style>
