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
		listPortfolios,
		createPortfolio,
		updatePortfolioContent,
		deletePortfolio,
		setDefaultPortfolio,
		slugify,
		portfolioPublicUrl,
		portfolioThemes,
		FREE_PORTFOLIO_LIMIT,
		parseApiError,
		type Portfolio
	} from '$lib/api/portfolios';
	import type { PortfolioDraftPreview } from '$lib/api/preview';
	import { createResume } from '$lib/api/resumes';
	import UpgradePrompt from '$lib/components/UpgradePrompt.svelte';
	import { getPlan, isProPlan, type PlanInfo } from '$lib/api/plan';
	import { listSkills, type Skill } from '$lib/api/skills';
	import { listProjects, type Project } from '$lib/api/projects';
	import { listExperience, type Experience } from '$lib/api/experience';
	import { listEducation, type Education } from '$lib/api/education';
	import { listCertifications, type Certification } from '$lib/api/certifications';
	import { listLanguages, type Language } from '$lib/api/languages';
	import { user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';
	import { confirmDelete } from '$lib/stores/confirm';

	let items: Portfolio[] = [];
	let loading = true;
	let creating = false;
	let pro = false;
	let billingAvailable = false;
	let planPricing: PlanInfo['pricing'] | null = null;
	let showWelcome = false;

	let name = '';
	let slug = '';
	let description = '';
	let themeSlug: (typeof portfolioThemes)[number] = 'minimal';
	let isPublic = false;
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

	let showCreate = false;
	let previewingId: string | null = null;

	$: atLimit = !pro && items.length >= FREE_PORTFOLIO_LIMIT;
	$: overLimit = !pro && items.length > FREE_PORTFOLIO_LIMIT;
	$: selectedSummary = [
		selectedProjects.size ? `${selectedProjects.size} project${selectedProjects.size === 1 ? '' : 's'}` : null,
		selectedExperience.size
			? `${selectedExperience.size} role${selectedExperience.size === 1 ? '' : 's'}`
			: null,
		selectedSkills.size ? `${selectedSkills.size} skill${selectedSkills.size === 1 ? '' : 's'}` : null,
		selectedEducation.size
			? `${selectedEducation.size} education`
			: null,
		selectedCertifications.size
			? `${selectedCertifications.size} cert${selectedCertifications.size === 1 ? '' : 's'}`
			: null,
		selectedLanguages.size
			? `${selectedLanguages.size} language${selectedLanguages.size === 1 ? '' : 's'}`
			: null
	]
		.filter(Boolean)
		.join(' · ') || 'Nothing selected yet';
	$: showCreateForm = showCreate || (!loading && items.length === 0);

	$: createDraft = (showCreateForm
		? {
				name: name.trim() || 'New portfolio',
				description,
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
			}
		: null) satisfies PortfolioDraftPreview | null;

	$: previewPortfolio = previewingId ? items.find((p) => p.id === previewingId) ?? null : null;
	$: previewLiveUrl =
		previewPortfolio && previewPortfolio.is_public === 1
			? publicUrl(previewPortfolio)
			: null;

	onMount(async () => {
		if ($page.url.searchParams.get('welcome') === '1') {
			showWelcome = true;
			const next = new URL($page.url);
			next.searchParams.delete('welcome');
			void goto(`${next.pathname}${next.search}`, { replaceState: true, noScroll: true });
		}
		try {
			const plan = await getPlan();
			pro = isProPlan(plan.plan);
			billingAvailable = plan.billing_available;
			planPricing = plan.pricing ?? null;
		} catch {
			pro = isProPlan($user?.plan);
		}
		await load();
	});

	async function load() {
		loading = true;
		try {
			const [portfolios, sk, pr, ex, ed, certs, langs] = await Promise.all([
				listPortfolios(),
				listSkills('confirmed'),
				listProjects(),
				listExperience(),
				listEducation(),
				listCertifications(),
				listLanguages()
			]);
			items = portfolios;
			skills = sk;
			projects = pr;
			experiences = ex;
			educations = ed;
			certifications = certs;
			languages = langs;
			// First-time create: include everything by default
			if (selectedSkills.size === 0 && selectedProjects.size === 0) {
				selectedSkills = new Set(sk.map((s) => s.id));
				selectedProjects = new Set(pr.map((p) => p.id));
				selectedExperience = new Set(ex.map((e) => e.id));
				selectedEducation = new Set(ed.map((e) => e.id));
				selectedCertifications = new Set(certs.map((c) => c.id));
				selectedLanguages = new Set(langs.map((l) => l.id));
			}
		} catch {
			items = [];
			showToast('Failed to load portfolios', 'error');
		} finally {
			loading = false;
		}
	}

	$: if (!slugTouched && name) slug = slugify(name);

	function resetForm() {
		name = '';
		slug = '';
		description = '';
		themeSlug = 'minimal';
		isPublic = false;
		slugTouched = false;
		showSkills = true;
		showProjects = true;
		showExperience = true;
		showEducation = true;
		showCertifications = true;
		showLanguages = true;
		skillsTitle = '';
		projectsTitle = '';
		experienceTitle = '';
		educationTitle = '';
		certificationsTitle = '';
		languagesTitle = '';
		selectedSkills = new Set(skills.map((s) => s.id));
		selectedProjects = new Set(projects.map((p) => p.id));
		selectedExperience = new Set(experiences.map((e) => e.id));
		selectedEducation = new Set(educations.map((e) => e.id));
		selectedCertifications = new Set(certifications.map((c) => c.id));
		selectedLanguages = new Set(languages.map((l) => l.id));
	}

	async function add() {
		if (atLimit) {
			showToast('Free plan includes 1 portfolio. Upgrade to Pro for unlimited.', 'error');
			return;
		}
		if (!name.trim() || !slug.trim()) {
			showToast('Name and slug are required', 'error');
			return;
		}
		creating = true;
		const createdSlug = slug.trim();
		const wasFirstPortfolio = items.length === 0;
		try {
			items = await createPortfolio({
				name: name.trim(),
				slug: createdSlug,
				description,
				theme_slug: themeSlug,
				is_public: isPublic ? 1 : 0,
				is_default: wasFirstPortfolio ? 1 : 0,
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
				sort_order: items.length
			});
			const created = items.find((p) => p.slug === createdSlug);
			if (created) {
				await updatePortfolioContent(created.id, {
					skill_ids: [...selectedSkills],
					project_ids: [...selectedProjects],
					experience_ids: [...selectedExperience],
					education_ids: [...selectedEducation],
					certification_ids: [...selectedCertifications],
					language_ids: [...selectedLanguages]
				});
				if (wasFirstPortfolio) {
					const when = new Date().toLocaleString('en-US', {
						month: 'short',
						year: 'numeric'
					});
					try {
						await createResume({
							name: `${created.name} — ${when}`,
							portfolio_id: created.id,
							theme_slug: 'classic',
							is_public: 0
						});
						showToast('Portfolio created · private resume draft ready', 'success');
					} catch {
						showToast('Portfolio created', 'success');
					}
				} else {
					showToast('Portfolio created', 'success');
				}
			} else {
				showToast('Portfolio created', 'success');
			}
			resetForm();
			showCreate = false;
			if (created) await goto(`/portfolios/${created.id}`);
		} catch (err) {
			const parsed = parseApiError(err);
			showToast(parsed.message, 'error');
		} finally {
			creating = false;
		}
	}

	async function makeDefault(id: string) {
		try {
			await setDefaultPortfolio(id);
			await load();
			showToast('Default portfolio updated', 'success');
		} catch {
			showToast('Failed to set default', 'error');
		}
	}

	async function remove(id: string) {
		const item = items.find((p) => p.id === id);
		if (!(await confirmDelete(item?.name?.trim() || 'this portfolio'))) return;
		try {
			await deletePortfolio(id);
			items = items.filter((p) => p.id !== id);
			if (previewingId === id) previewingId = null;
			showToast('Portfolio deleted', 'success');
		} catch {
			showToast('Failed to delete portfolio', 'error');
		}
	}

	function togglePreview(id: string) {
		showCreate = false;
		previewingId = previewingId === id ? null : id;
	}

	function openCreate() {
		previewingId = null;
		showCreate = true;
	}

	function publicUrl(p: Portfolio) {
		return portfolioPublicUrl($user?.handle, p);
	}

	function dismissWelcome() {
		showWelcome = false;
	}

	$: publicDefault = items.find((p) => p.is_default === 1 && p.is_public === 1) ?? null;
	$: hasOtherPublic = items.some((p) => p.is_public === 1 && p.is_default !== 1);
	$: showExposureWarning = !!publicDefault && hasOtherPublic;
</script>

<PageHeader
	title="Portfolios"
	description="Public presentations of your library. Choose what visitors will see — default portfolio powers /u/your-handle."
/>

{#if showWelcome}
	<div class="welcome-banner" role="status">
		<div>
			<strong>
				{#if $user?.handle}
					You’re live at /u/{$user.handle}
				{:else}
					You’re in — create your first portfolio
				{/if}
			</strong>
			<p>
				{#if items.length === 0}
					Name it, pick a theme, choose what visitors will see, then publish when you’re ready.
				{:else}
					Publish or polish a portfolio so visitors have somewhere to land.
				{/if}
			</p>
		</div>
		<button type="button" class="welcome-dismiss" on:click={dismissWelcome}>Dismiss</button>
	</div>
{/if}

{#if showExposureWarning}
	<div class="exposure-banner" role="status">
		<strong>Your default portfolio is public</strong>
		<p>
			Anyone who shortens one of your other portfolio links down to <code
				>/u/{$user?.handle ?? 'you'}</code
			> will land on “{publicDefault?.name}” instead. If a specific link (e.g. for a client) should
			stay separate, either keep the default private or share a <em>private link</em> for that portfolio
			from its edit page instead of its public URL.
		</p>
	</div>
{/if}

{#if atLimit}
	<UpgradePrompt
		title={overLimit ? 'Pro expired — over Free portfolio limit' : 'Portfolio limit reached'}
		message={overLimit
			? `Free includes ${FREE_PORTFOLIO_LIMIT} portfolio. Your ${items.length} portfolios stay live and editable — delete extras or renew Pro to create more.`
			: `Free plan includes ${FREE_PORTFOLIO_LIMIT} portfolio. Upgrade to Pro for unlimited portfolios (different audiences, roles, or themes).`}
		pricing={planPricing}
		billingAvailable={billingAvailable}
		on:upgraded={() => {
			pro = true;
		}}
	/>
{/if}

<EditorWithPortfolioPreview
	portfolioId={showCreateForm ? null : previewingId}
	draft={createDraft}
	portfolioName={showCreateForm
		? name.trim() || 'New portfolio'
		: previewPortfolio?.name ?? 'Portfolio'}
	liveUrl={showCreateForm ? null : previewLiveUrl}
>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if items.length === 0}
		<p class="muted empty">No portfolios yet — create your first one below.</p>
	{:else}
		<ul class="list">
			{#each items as p (p.id)}
				<li
					class:previewing={previewingId === p.id && !showCreateForm}
					aria-current={previewingId === p.id && !showCreateForm ? 'true' : undefined}
				>
					<Card>
						<div class="row">
							<div>
								<h2>
									{p.name}
									{#if previewingId === p.id && !showCreateForm}<span class="tag previewing">previewing</span>{/if}
									{#if p.is_default}<span class="star">default</span>{/if}
									{#if p.is_public}<span class="tag public">public</span>{:else}<span
											class="tag private">private</span
										>{/if}
								</h2>
								<p class="slug">
									/{p.slug}{#if p.is_default}
										· also <code>/u/{$user?.handle ?? 'you'}</code>{/if}
								</p>
								<p class="url">{publicUrl(p)}</p>
							</div>
							<div class="actions">
								<Button
									variant="ghost"
									on:click={() => togglePreview(p.id)}
									pressed={previewingId === p.id && !showCreateForm}
								>
									{previewingId === p.id && !showCreateForm ? 'Hide preview' : 'Preview'}
								</Button>
								<Button variant="ghost" on:click={() => goto(`/portfolios/${p.id}`)}
									>Edit</Button
								>
								{#if !p.is_default}
									<Button variant="ghost" on:click={() => makeDefault(p.id)}
										>Set default</Button
									>
								{/if}
								<Button variant="ghost" on:click={() => remove(p.id)}>Delete</Button>
							</div>
						</div>
					</Card>
				</li>
			{/each}
		</ul>
	{/if}

	{#if !atLimit}
		{#if !showCreateForm}
			<div class="create-cta">
				<Button on:click={openCreate}>New portfolio</Button>
			</div>
		{:else}
			<div class="create-wrap previewing">
			<Card>
				<div class="create-head">
					<h2 class="section-title">New portfolio <span class="tag previewing">previewing</span></h2>
					{#if items.length > 0}
						<Button
							variant="ghost"
							on:click={() => {
								showCreate = false;
							}}>Cancel</Button
						>
					{/if}
				</div>

				<details class="step" open>
					<summary>1. Details</summary>
					<div class="fields">
						<Input label="Name" bind:value={name} placeholder="Backend engineer folio" />
						<Input label="Slug" bind:value={slug} on:input={() => (slugTouched = true)} />
						<Textarea label="Description" bind:value={description} rows={2} />
						<label class="field">
							<span class="label">Theme</span>
							<select bind:value={themeSlug}>
								{#each portfolioThemes as t}
									<option value={t}>{t}</option>
								{/each}
							</select>
						</label>
						<label class="checkbox">
							<input type="checkbox" bind:checked={isPublic} />
							Publish publicly
						</label>
					</div>
				</details>

				<details class="step" open>
					<summary>
						2. What visitors will see
						<span class="step-meta">{selectedSummary}</span>
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
						title="Choose what visitors will see"
						hint="Turn sections on or off, then open each section to pick individual items. Everything starts selected — trim what doesn’t belong. Optional titles rename public headings (Projects → Papers, Gallery…)."
					/>
				</details>

				<div class="form-actions">
					<Button disabled={creating} on:click={add}
						>{creating ? 'Creating…' : 'Create portfolio'}</Button
					>
				</div>
			</Card>
			</div>
		{/if}
	{/if}
</EditorWithPortfolioPreview>

<style>
	.section-title {
		margin: 0;
		font-size: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.create-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.create-cta {
		margin-top: 1.25rem;
	}
	.step {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 0.65rem 0.85rem;
		margin-bottom: 0.75rem;
		background: var(--color-bg, transparent);
	}
	.step summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.step-meta {
		font-weight: 500;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.step[open] summary {
		margin-bottom: 0.75rem;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 0.25rem;
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
		margin-top: 1.25rem;
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
		margin: 0 0 0.25rem;
		font-size: 1.125rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.star {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
		background: var(--color-primary-light);
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
	}
	.tag {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 0.15rem 0.45rem;
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
	.list li.previewing :global(.card),
	.create-wrap.previewing :global(.card) {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
	}
	.slug,
	.url {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.url {
		font-family: ui-monospace, monospace;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.welcome-banner {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 0 1.25rem;
		padding: 1rem 1.15rem;
		border: 1px solid var(--color-primary, #0f766e);
		border-radius: 8px;
		background: var(--color-primary-light, #ecfdf5);
	}
	.exposure-banner {
		margin: 0 0 1.25rem;
		padding: 0.85rem 1.1rem;
		border: 1px solid #f59e0b;
		border-radius: 8px;
		background: #fffbeb;
	}
	.exposure-banner strong {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.9rem;
	}
	.exposure-banner p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.exposure-banner code {
		font-family: ui-monospace, monospace;
	}
	.welcome-banner strong {
		display: block;
		margin-bottom: 0.25rem;
	}
	.welcome-banner p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.welcome-dismiss {
		flex-shrink: 0;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.welcome-banner {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}
		.welcome-dismiss {
			align-self: flex-end;
		}
		.actions {
			width: 100%;
		}
		.actions :global(button),
		.actions :global(a) {
			flex: 1 1 auto;
		}
	}
</style>
