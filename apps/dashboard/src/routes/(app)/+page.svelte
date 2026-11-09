<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
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

	type GettingStartedStep = {
		id: string;
		title: string;
		detail: string;
		href: string;
		cta: string;
		done: boolean;
		secondaryHref?: string;
		secondaryCta?: string;
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
	$: libraryHasContent = libraryFilled > 0;
	$: showGettingStarted = !loading && (!libraryHasContent || portfolios.length === 0);
	$: gettingStartedSteps = buildGettingStarted({
		libraryHasContent,
		hasBasics: Boolean(profile?.name?.trim()),
		hasPortfolio: portfolios.length > 0,
		pro
	});
	$: nextSteps = showGettingStarted
		? []
		: buildNextSteps({
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
			if ($page.url.searchParams.get('start') === '1') {
				const next = new URL($page.url);
				next.searchParams.delete('start');
				void goto(`${next.pathname}${next.search}`, { replaceState: true, noScroll: true });
			}
		}
	});

	function buildGettingStarted(ctx: {
		libraryHasContent: boolean;
		hasBasics: boolean;
		hasPortfolio: boolean;
		pro: boolean;
	}): GettingStartedStep[] {
		const importDetail = isSaas
			? ctx.pro
				? 'Upload a PDF or paste your CV — AI fills your library in one pass.'
				: 'Import resume is Pro — upgrade, or add Basics and library items by hand.'
			: 'Upload a PDF with OpenRouter BYOK, import a .fio package, or add Basics by hand.';
		const importCta = isSaas ? (ctx.pro ? 'Import resume' : 'Open import') : 'Import resume';

		return [
			{
				id: 'import',
				title: 'Import your resume',
				detail: importDetail,
				href: '/import?onboarding=1',
				cta: importCta,
				done: ctx.libraryHasContent,
				secondaryHref: '/basics',
				secondaryCta: 'Or start with Basics'
			},
			{
				id: 'review',
				title: 'Review your library',
				detail: ctx.libraryHasContent
					? 'Confirm basics, skills, and experience — edit anything that looks wrong.'
					: 'After import, skim your library so portfolios and resumes stay accurate.',
				href: ctx.hasBasics ? '/skills' : '/basics',
				cta: 'Review library',
				done: ctx.libraryHasContent && ctx.hasBasics
			},
			{
				id: 'portfolio',
				title: 'Create your default portfolio',
				detail: 'Choose what visitors will see, pick a theme, then publish when you’re ready.',
				href: '/portfolios',
				cta: 'Create portfolio',
				done: ctx.hasPortfolio
			}
		];
	}

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
				detail: 'Paste a JD to tailor from your library, or copy a folio.',
				href: '/resume/tailor',
				cta: 'Tailor to a job'
			});
		}
		if (!ctx.handle && isSaas) {
			steps.push({
				title: 'Claim your handle',
				detail: 'Pick a short public URL for your portfolio.',
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
	description="Your library, portfolios, and resumes — update once, reuse everywhere."
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

	{#if showGettingStarted}
		<section class="section getting-started">
			<div class="section-head">
				<h3 class="section-title">Get started</h3>
			</div>
			<p class="muted gs-lead">Import once → review your library → create your default portfolio.</p>
			<ol class="gs-steps">
				{#each gettingStartedSteps as step, i}
					<li
						class="gs-step"
						class:done={step.done}
						class:active={!step.done && gettingStartedSteps.slice(0, i).every((s) => s.done)}
					>
						<div class="gs-num" aria-hidden="true">{step.done ? '✓' : i + 1}</div>
						<div class="gs-body">
							<h4>{step.title}</h4>
							<p class="muted">{step.detail}</p>
							{#if !step.done}
								<div class="gs-actions">
									<a class="gs-cta" href={step.href}>{step.cta} →</a>
									{#if step.secondaryHref && step.secondaryCta && step.id === 'import'}
										<a class="gs-secondary" href={step.secondaryHref}>{step.secondaryCta}</a>
									{/if}
								</div>
							{:else}
								<p class="gs-done-label">Done</p>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</section>
	{:else if nextSteps.length}
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
			<h3 class="section-title">My Library</h3>
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
				<Card variant="panel">
					<p class="muted">No portfolios yet. Choose what visitors will see from your library.</p>
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
				<Card variant="panel">
					<p class="muted">No resumes yet. Tailor one to a JD, or copy a folio.</p>
					<a href="/resume/tailor">Tailor to a job →</a>
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
			<Card variant="panel">
				{#if isSaas && !pro}
					<p class="muted">Import resume is a Pro feature — upgrade to extract a CV into Foliyo.</p>
					<a href="/import">Import resume (Pro) →</a>
				{:else if isSaas}
					<p class="muted">Fill the library faster from a PDF or pasted CV.</p>
					<a href="/import?onboarding=1">Import resume →</a>
				{:else}
					<p class="muted">
						Import a .fio package, or set OPENROUTER_API_KEY for AI PDF/text import (BYOK).
					</p>
					<a href="/import?onboarding=1">Import resume →</a>
				{/if}
			</Card>
		</div>
	</section>
{/if}

<style>
	.muted {
		color: var(--color-muted);
		font-size: 0.8125rem;
		margin: 0;
	}
	.welcome {
		display: grid;
		grid-template-columns: 1.5fr auto;
		gap: var(--space-4);
		padding: var(--space-4) var(--space-5);
		margin-bottom: var(--space-5);
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		background:
			linear-gradient(135deg, var(--color-primary-light) 0%, transparent 55%),
			var(--color-surface);
		box-shadow: var(--shadow-xs);
	}
	.eyebrow {
		margin: 0 0 0.15rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.welcome-name {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.2;
	}
	.headline {
		margin: 0.25rem 0 0.5rem;
		font-size: 0.875rem;
	}
	.public-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.public-link {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-primary);
		word-break: break-all;
	}
	.copy {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius);
		padding: 0.2rem 0.5rem;
		font-size: 0.6875rem;
		cursor: pointer;
		color: var(--color-text);
	}
	.copy:hover {
		border-color: var(--color-primary-muted);
		color: var(--color-primary);
	}
	.welcome-meta {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		justify-content: flex-end;
	}
	.meta-chip {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 5.5rem;
	}
	.meta-label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.meta-chip strong {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.meta-chip strong.plan-pro {
		color: var(--color-primary);
	}
	.upgrade {
		font-size: 0.75rem;
		font-weight: 600;
		width: 100%;
		text-align: right;
	}
	.section {
		margin-bottom: var(--space-5);
	}
	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.section-title {
		margin: 0 0 var(--space-2);
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.section-head .section-title {
		margin: 0;
	}
	.section-head a {
		font-size: 0.75rem;
		font-weight: 600;
	}
	.gs-lead {
		margin: 0 0 var(--space-3);
	}
	.gs-steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.gs-step {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.gs-step.active {
		border-color: var(--color-primary-muted);
		background: var(--color-primary-light);
	}
	.gs-step.done {
		opacity: 0.72;
	}
	.gs-num {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}
	.gs-step.active .gs-num {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: #fff;
	}
	.gs-step.done .gs-num {
		background: var(--color-success-bg);
		border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
		color: var(--color-success-text);
	}
	.gs-body {
		flex: 1;
		min-width: 0;
	}
	.gs-body h4 {
		margin: 0 0 0.15rem;
		font-size: 0.875rem;
	}
	.gs-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	.gs-cta {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.gs-secondary {
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.gs-done-label {
		margin: var(--space-2) 0 0;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--color-success-text);
	}
	.steps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-3);
	}
	.step-index {
		margin: 0 0 0.25rem;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-primary-muted);
	}
	.steps h4 {
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}
	.steps a {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.steps :global(.card) {
		padding: var(--space-4);
		box-shadow: var(--shadow-xs);
	}
	.steps .muted {
		margin: 0 0 var(--space-2);
	}
	.counts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: var(--space-2);
	}
	.count-tile {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: var(--space-3);
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
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1;
		color: var(--color-primary);
	}
	.count-label {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.count-hint {
		font-size: 0.6875rem;
		color: var(--color-muted);
	}
	.publish {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}
	.publish-col {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
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
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
	}
	.list li:last-child {
		border-bottom: none;
	}
	.list strong {
		font-size: 0.8125rem;
		margin-right: 0.35rem;
	}
	.badge {
		display: inline-block;
		font-size: 0.625rem;
		font-weight: 600;
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-muted);
		border: 1px solid var(--color-border);
	}
	.badge.on {
		color: var(--color-success-text);
		background: var(--color-success-bg);
		border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
	}
	.badge.default {
		color: var(--color-primary);
		background: var(--color-primary-light);
		border-color: transparent;
	}
	.views {
		margin-left: 0.35rem;
		font-size: 0.6875rem;
		color: var(--color-muted);
	}
	.list-link {
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}
	@media (max-width: 800px) {
		.welcome,
		.publish {
			grid-template-columns: 1fr;
		}
		.welcome-meta {
			justify-content: flex-start;
		}
		.upgrade {
			text-align: left;
		}
		.list-link {
			white-space: normal;
		}
		.welcome {
			padding: var(--space-3) var(--space-4);
		}
		.welcome-name {
			font-size: 1.125rem;
		}
	}
</style>
