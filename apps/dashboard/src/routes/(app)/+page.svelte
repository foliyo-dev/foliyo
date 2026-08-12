<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';
	import { getProfile, type Profile } from '$lib/api/profile';
	import { listSkills } from '$lib/api/skills';
	import { listProjects } from '$lib/api/projects';
	import { listExperience } from '$lib/api/experience';
	import { listEducation } from '$lib/api/education';
	import { listCertifications } from '$lib/api/certifications';
	import { listLanguages } from '$lib/api/languages';
	import { listSocialLinks } from '$lib/api/social';
	import { listPortfolios, FREE_PORTFOLIO_LIMIT, portfolioPublicUrl, type Portfolio } from '$lib/api/portfolios';
	import { listResumes, resumeShareUrl, type Resume } from '$lib/api/resumes';
	import { formatPlanLabel, getPlan, isProPlan, type PlanInfo } from '$lib/api/plan';
	import UpgradePrompt from '$lib/components/UpgradePrompt.svelte';
	import { isSaas, publicHost, publicPortfolioPath } from '$lib/config';

	type LibraryItem = {
		label: string;
		href: string;
		count: number;
		hint: string;
	};

	type NextStep = {
		title: string;
		detail: string;
		href: string;
		cta: string;
	};

	let loading = true;
	let profile: Profile | null = null;
	let planInfo: PlanInfo | null = null;
	let portfolios: Portfolio[] = [];
	let resumes: Resume[] = [];
	let library: LibraryItem[] = [];

	$: handle = $user?.handle ?? null;
	$: displayName = profile?.name?.trim() || handle || $user?.email?.split('@')[0] || 'there';
	$: planSlug = planInfo?.plan ?? $user?.plan ?? (isSaas ? 'free' : 'selfhost');
	$: planLabel = formatPlanLabel(planSlug);
	$: pro = isProPlan(planSlug);
	$: overPortfolioLimit = !pro && portfolios.length > FREE_PORTFOLIO_LIMIT;
	$: publicUrl = handle ? publicPortfolioPath(handle) : null;
	$: publicPortfolios = portfolios.filter((p) => p.is_public);
	$: libraryFilled = library.filter((i) => i.count > 0).length;
	$: libraryTotal = library.length;
	$: nextSteps = buildNextSteps({
		profile,
		library,
		portfolios,
		resumes,
		handle
	});

	onMount(async () => {
		try {
			const [
				profileRes,
				skills,
				projects,
				experience,
				education,
				certs,
				languages,
				social,
				folios,
				resumeList,
				plan
			] = await Promise.all([
				getProfile().catch(() => null),
				listSkills().catch(() => []),
				listProjects().catch(() => []),
				listExperience().catch(() => []),
				listEducation().catch(() => []),
				listCertifications().catch(() => []),
				listLanguages().catch(() => []),
				listSocialLinks().catch(() => []),
				listPortfolios().catch(() => []),
				listResumes().catch(() => []),
				getPlan().catch(() => null)
			]);

			profile = profileRes;
			portfolios = folios;
			resumes = resumeList;
			planInfo = plan;
			library = [
				{ label: 'Skills', href: '/skills', count: skills.length, hint: 'What you know' },
				{ label: 'Projects', href: '/projects', count: projects.length, hint: 'Work to show' },
				{
					label: 'Experience',
					href: '/experience',
					count: experience.length,
					hint: 'Roles & companies'
				},
				{ label: 'Education', href: '/education', count: education.length, hint: 'Schools' },
				{
					label: 'Certifications',
					href: '/certifications',
					count: certs.length,
					hint: 'Credentials'
				},
				{ label: 'Languages', href: '/languages', count: languages.length, hint: 'Spoken' },
				{ label: 'Social', href: '/social', count: social.length, hint: 'Profiles & sites' }
			];
		} finally {
			loading = false;
		}
	});

	function buildNextSteps(ctx: {
		profile: Profile | null;
		library: LibraryItem[];
		portfolios: Portfolio[];
		resumes: Resume[];
		handle: string | null;
	}): NextStep[] {
		const steps: NextStep[] = [];
		const p = ctx.profile;
		if (!p?.name?.trim() || !p?.headline?.trim()) {
			if (isSaas) {
				steps.push({
					title: pro ? 'Try AI resume' : 'AI resume (Pro)',
					detail: pro
						? 'Upload a PDF or paste text — AI fills your library.'
						: 'Upgrade to Pro to fill your library from a PDF or pasted CV.',
					href: '/import',
					cta: pro ? 'Open AI resume' : 'See Pro AI resume'
				});
			}
			steps.push({
				title: 'Complete your basics',
				detail: 'Add your name and headline — they appear on every public page.',
				href: '/basics',
				cta: 'Edit basics'
			});
		}
		const projects = ctx.library.find((i) => i.href === '/projects');
		if (projects && projects.count === 0) {
			steps.push({
				title: 'Add a project',
				detail: 'One solid project makes a portfolio feel real.',
				href: '/projects',
				cta: 'Add project'
			});
		}
		const experience = ctx.library.find((i) => i.href === '/experience');
		if (experience && experience.count === 0) {
			steps.push({
				title: 'Add experience',
				detail: 'Roles and companies feed both portfolio and resume.',
				href: '/experience',
				cta: 'Add experience'
			});
		}
		if (ctx.portfolios.length === 0) {
			steps.push({
				title: 'Create a portfolio',
				detail: 'Curate library items into a public page at /u/your-handle.',
				href: '/portfolios',
				cta: 'Create portfolio'
			});
		} else if (ctx.portfolios.every((f) => !f.is_public)) {
			steps.push({
				title: 'Publish a portfolio',
				detail: 'You have a draft — turn on public so others can open it.',
				href: '/portfolios',
				cta: 'Manage portfolios'
			});
		}
		if (ctx.resumes.length === 0) {
			steps.push({
				title: 'Create a resume',
				detail: 'Reuse the same library and share a private link or export PDF.',
				href: '/resume',
				cta: 'Open resume'
			});
		}
		if (!ctx.handle && isSaas) {
			steps.push({
				title: 'Claim your handle',
				detail: 'Pick a short public URL for your folio.',
				href: '/onboarding',
				cta: 'Claim handle'
			});
		}
		return steps.slice(0, 3);
	}

	function copyPublicUrl() {
		if (!publicUrl) return;
		void navigator.clipboard.writeText(publicUrl).then(
			() => showToast('Public URL copied', 'success'),
			() => showToast('Could not copy URL', 'error')
		);
	}
</script>

<PageHeader
	title="Overview"
	description="Your library, public folio, and resume — at a glance."
/>

{#if loading}
	<p class="muted">Loading your workspace…</p>
{:else}
	{#if overPortfolioLimit}
		<UpgradePrompt
			title="Pro expired — over Free portfolio limit"
			message={`Free includes ${FREE_PORTFOLIO_LIMIT} portfolio. Your ${portfolios.length} portfolios stay live — delete extras or renew to create more.`}
			pricing={planInfo?.pricing ?? null}
			billingAvailable={planInfo?.billing_available ?? false}
			on:upgraded={(e) => {
				planInfo = e.detail;
			}}
		/>
	{/if}
	<section class="welcome">
		<div class="welcome-main">
			<p class="eyebrow">Signed in as</p>
			<h2 class="welcome-name">{displayName}</h2>
			{#if profile?.headline}
				<p class="headline">{profile.headline}</p>
			{:else}
				<p class="headline muted">Add a headline in Basics so visitors know what you do.</p>
			{/if}
			{#if publicUrl}
				<div class="public-row">
					<a class="public-link" href={publicUrl} target="_blank" rel="noreferrer">
						{publicHost()}/u/{handle}
					</a>
					<button type="button" class="copy" on:click={copyPublicUrl}>Copy</button>
				</div>
			{/if}
		</div>
		<div class="welcome-meta">
			<div class="meta-chip">
				<span class="meta-label">Plan</span>
				<strong class:plan-pro={planSlug === 'pro' || planSlug === 'lifetime'}>{planLabel}</strong>
			</div>
			<div class="meta-chip">
				<span class="meta-label">Library</span>
				<strong>{libraryFilled}/{libraryTotal} sections filled</strong>
			</div>
			<div class="meta-chip">
				<span class="meta-label">Published</span>
				<strong
					>{publicPortfolios.length} portfolio{publicPortfolios.length === 1 ? '' : 's'} · {resumes.length}
					resume{resumes.length === 1 ? '' : 's'}</strong
				>
			</div>
			{#if isSaas && !pro}
				<a class="upgrade" href="/settings">Upgrade in Settings →</a>
			{/if}
		</div>
	</section>

	{#if nextSteps.length}
		<section class="section">
			<h3 class="section-title">Suggested next steps</h3>
			<div class="steps">
				{#each nextSteps as step, i}
					<Card>
						<p class="step-index">Step {i + 1}</p>
						<h4>{step.title}</h4>
						<p class="muted">{step.detail}</p>
						<a href={step.href}>{step.cta} →</a>
					</Card>
				{/each}
			</div>
		</section>
	{/if}

	<section class="section">
		<div class="section-head">
			<h3 class="section-title">Content library</h3>
			<a href="/basics">Edit basics →</a>
		</div>
		<div class="counts">
			{#each library as item}
				<a class="count-tile" href={item.href} class:empty={item.count === 0}>
					<span class="count-num">{item.count}</span>
					<span class="count-label">{item.label}</span>
					<span class="count-hint">{item.hint}</span>
				</a>
			{/each}
		</div>
	</section>

	<section class="section publish">
		<div class="publish-col">
			<div class="section-head">
				<h3 class="section-title">Portfolios</h3>
				<a href="/portfolios">Manage →</a>
			</div>
			{#if portfolios.length === 0}
				<Card>
					<p class="muted">No portfolios yet. Curate library items into a public page.</p>
					<a href="/portfolios">Create portfolio →</a>
				</Card>
			{:else}
				<ul class="list">
					{#each portfolios as folio}
						<li>
							<div>
								<strong>{folio.name}</strong>
								<span class="badge" class:on={folio.is_public}
									>{folio.is_public ? 'Public' : 'Private'}</span
								>
								{#if folio.is_default}
									<span class="badge default">Default</span>
								{/if}
							</div>
							{#if folio.is_public && handle}
								<a
									class="list-link"
									href={portfolioPublicUrl(handle, folio)}
									target="_blank"
									rel="noreferrer"
								>
									Open live →
								</a>
							{:else}
								<a class="list-link" href={`/portfolios/${folio.id}`}>Edit →</a>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="publish-col">
			<div class="section-head">
				<h3 class="section-title">Resumes</h3>
				<a href="/resume">Manage →</a>
			</div>
			{#if resumes.length === 0}
				<Card>
					<p class="muted">No resumes yet. Build one from the same library and share a link.</p>
					<a href="/resume">Create resume →</a>
				</Card>
			{:else}
				<ul class="list">
					{#each resumes as resume}
						<li>
							<div>
								<strong>{resume.name}</strong>
								<span class="badge" class:on={resume.is_public}
									>{resume.is_public ? 'Public' : 'Link only'}</span
								>
								{#if resume.view_count}
									<span class="views">{resume.view_count} views</span>
								{/if}
							</div>
							<a
								class="list-link"
								href={resumeShareUrl(resume.share_token)}
								target="_blank"
								rel="noreferrer"
							>
								Open share link →
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			{#if isSaas}
				<Card>
					{#if pro}
						<p class="muted">Fill the library faster from a PDF or pasted CV.</p>
						<a href="/import">AI resume →</a>
					{:else}
						<p class="muted">AI resume is a Pro feature — upgrade to extract a CV into Foliyo.</p>
						<a href="/import">AI resume (Pro) →</a>
					{/if}
				</Card>
			{/if}
		</div>
	</section>

	<section class="section">
		<h3 class="section-title">Quick links</h3>
		<div class="grid">
			<Card>
				<h4>My content</h4>
				<p class="muted">
					Basics, skills, projects, experience, education, certifications, and languages.
				</p>
				<a href="/basics">Edit basics →</a>
			</Card>
			<Card>
				<h4>Portfolios</h4>
				<p class="muted">
					Curate public views from your library — Free includes 1, Pro unlimited.
				</p>
				<a href="/portfolios">Manage portfolios →</a>
			</Card>
			<Card>
				<h4>Resume</h4>
				<p class="muted">Reuse the same library, pick a theme, and export PDF.</p>
				<a href="/resume">Open resume →</a>
			</Card>
			<Card>
				<h4>Settings</h4>
				<p class="muted">Site title, themes, plan, custom domain, and privacy exports.</p>
				<a href="/settings">Open settings →</a>
			</Card>
		</div>
	</section>
{/if}

<style>
	.muted {
		color: var(--color-muted);
		font-size: 0.875rem;
		margin: 0;
	}
	.welcome {
		display: grid;
		grid-template-columns: 1.4fr 1fr;
		gap: 1.25rem;
		padding: 1.25rem 1.5rem;
		margin-bottom: 1.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		background:
			linear-gradient(135deg, var(--color-primary-light) 0%, transparent 55%),
			var(--color-surface);
	}
	.eyebrow {
		margin: 0 0 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.welcome-name {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.2;
	}
	.headline {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.95rem;
	}
	.public-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.public-link {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-primary);
		word-break: break-all;
	}
	.copy {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius);
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		cursor: pointer;
		color: var(--color-text);
	}
	.copy:hover {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
	}
	.welcome-meta {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		justify-content: center;
	}
	.meta-chip {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.meta-label {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.meta-chip strong {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.meta-chip strong.plan-pro {
		color: var(--color-primary);
	}
	.upgrade {
		font-size: 0.8125rem;
		font-weight: 600;
		margin-top: 0.25rem;
	}
	.section {
		margin-bottom: 1.75rem;
	}
	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.section-title {
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}
	.section-head .section-title {
		margin: 0;
	}
	.section-head a {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.steps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 1rem;
	}
	.step-index {
		margin: 0 0 0.35rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-primary-muted);
	}
	.steps h4,
	.grid h4 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}
	.steps a,
	.grid a {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.counts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.75rem;
	}
	.count-tile {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.count-tile:hover {
		border-color: var(--color-primary-muted);
		background: var(--color-primary-light);
		color: inherit;
	}
	.count-tile.empty {
		opacity: 0.85;
	}
	.count-num {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
		color: var(--color-primary);
	}
	.count-label {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.count-hint {
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.publish {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		overflow: hidden;
	}
	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--color-border);
	}
	.list li:last-child {
		border-bottom: none;
	}
	.list strong {
		font-size: 0.875rem;
		margin-right: 0.4rem;
	}
	.badge {
		display: inline-block;
		font-size: 0.6875rem;
		font-weight: 600;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		background: var(--color-bg);
		color: var(--color-muted);
		border: 1px solid var(--color-border);
	}
	.badge.on {
		color: #166534;
		background: #dcfce7;
		border-color: #bbf7d0;
	}
	.badge.default {
		color: var(--color-primary);
		background: var(--color-primary-light);
		border-color: transparent;
	}
	.views {
		margin-left: 0.35rem;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.list-link {
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 1rem;
	}
	.grid .muted,
	.steps .muted {
		margin: 0 0 0.75rem;
	}
	@media (max-width: 800px) {
		.welcome,
		.publish {
			grid-template-columns: 1fr;
		}
		.grid {
			grid-template-columns: 1fr;
		}
		.list-link {
			white-space: normal;
		}
		.welcome {
			padding: 1rem 1.1rem;
		}
		.welcome-name {
			font-size: 1.25rem;
		}
	}
</style>
