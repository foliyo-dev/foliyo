<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { tailorResume, resumeThemes } from '$lib/api/resumes';
	import {
		analyzeJob,
		approvedFromAnalysis,
		defaultAcceptedIds,
		getSavedJobAnalysis,
		hashJdText,
		listJobAnalyses,
		patchJobAnalysisAccepted,
		suggestedTailoredResumeName,
		type JobAnalysis,
		type JobAnalysisSummary
	} from '$lib/api/jobs';
	import JobAnalysisPanel from '$lib/components/jobs/JobAnalysisPanel.svelte';
	import AiSummaryAssist from '$lib/components/AiSummaryAssist.svelte';
	import { clearJdSession, loadJdSession, saveJdSession } from '$lib/utils/jdSession';
	import { listPortfolios, type Portfolio } from '$lib/api/portfolios';
	import { showToast } from '$lib/stores/toast';
	import { ApiError } from '$lib/api/client';
	import { getPlan, isProPlan, type PlanInfo } from '$lib/api/plan';
	import { getAiUsage, type AiUsage } from '$lib/api/ai';
	import { isSaas } from '$lib/config';

	let portfolios: Portfolio[] = [];
	let loading = true;
	let saving = false;
	let jobAnalysis: JobAnalysis | null = null;
	let acceptedChanges = new Set<string>();
	let analyzeBusy = false;
	let enhanceParse = false;
	let savedAnalysisId: string | null = null;
	let recentAnalyses: JobAnalysisSummary[] = [];
	let matchedAnalysisId: string | null = null;
	let sessionReady = false;
	let acceptedPatchTimer: ReturnType<typeof setTimeout> | null = null;
	let jdHashTimer: ReturnType<typeof setTimeout> | null = null;
	let planInfo: PlanInfo | null = null;
	let aiUsage: AiUsage | null = null;
	$: pro = isProPlan(planInfo?.plan ?? 'free');
	$: analyzeCost = aiUsage?.costs.analyze ?? 1;
	$: outOfAiUnits = aiUsage != null && aiUsage.remaining < analyzeCost;
	$: summarySkillNames = jobAnalysis
		? jobAnalysis.matches
				.filter((m) => m.band !== 'missing' && m.skill_name)
				.map((m) => m.skill_name as string)
		: [];

	let name = '';
	let nameTouched = false;
	let portfolioId = '';
	let themeSlug: (typeof resumeThemes)[number] = 'classic';
	let isPublic = false;
	let jdText = '';
	let headline = '';
	let bio = '';
	let includeMatching = true;
	let createOpen = false;
	let createDialog: HTMLDialogElement | undefined;

	$: suggestedName = buildSuggestedName();
	$: if (!nameTouched) name = suggestedName;
	$: if (createDialog) {
		if (createOpen && !createDialog.open) createDialog.showModal();
		if (!createOpen && createDialog.open) createDialog.close();
	}

	onMount(load);

	async function load() {
		loading = true;
		try {
			const [p, plan] = await Promise.all([listPortfolios(), getPlan().catch(() => null)]);
			portfolios = p;
			planInfo = plan;
			if (!portfolioId) {
				portfolioId = portfolios.find((p) => p.is_default)?.id ?? portfolios[0]?.id ?? '';
			}
			await Promise.all([restoreJdSession(), refreshAiUsage()]);
			const fromUrl = page.url.searchParams.get('analysis');
			if (fromUrl) {
				try {
					await openSavedAnalysis(fromUrl);
				} catch {
					showToast('Could not open that analysis', 'error');
				}
			}
		} catch {
			portfolios = [];
			showToast('Failed to load', 'error');
		} finally {
			loading = false;
			sessionReady = true;
			persistJdSession();
		}
	}

	function persistJdSession() {
		if (!sessionReady) return;
		saveJdSession({
			jdText,
			analysisId: savedAnalysisId,
			accepted: [...acceptedChanges],
			enhanceParse,
			portfolioId
		});
	}

	async function refreshAiUsage() {
		if (!isSaas) {
			aiUsage = null;
			return;
		}
		try {
			aiUsage = await getAiUsage();
		} catch {
			aiUsage = null;
		}
	}

	async function refreshRecentAnalyses() {
		try {
			const { items: recents } = await listJobAnalyses();
			recentAnalyses = recents;
		} catch {
			recentAnalyses = [];
		}
	}

	async function restoreJdSession() {
		await refreshRecentAnalyses();
		const session = loadJdSession();
		if (!session) return;
		jdText = session.jdText;
		enhanceParse = session.enhanceParse;
		if (session.portfolioId && portfolios.some((p) => p.id === session.portfolioId)) {
			portfolioId = session.portfolioId;
		}
		if (session.analysisId) {
			try {
				await openSavedAnalysis(session.analysisId, session.accepted);
			} catch {
				savedAnalysisId = null;
				jobAnalysis = null;
			}
		}
		void matchSavedJd();
	}

	async function openSavedAnalysis(id: string, acceptedOverride?: string[]) {
		const saved = await getSavedJobAnalysis(id);
		savedAnalysisId = saved.id;
		jobAnalysis = saved.analysis;
		jdText = saved.jd_text;
		acceptedChanges = new Set(acceptedOverride?.length ? acceptedOverride : saved.accepted);
		if (acceptedChanges.size === 0) acceptedChanges = defaultAcceptedIds(saved.analysis);
		persistJdSession();
	}

	async function matchSavedJd() {
		if (!jdText.trim()) {
			matchedAnalysisId = null;
			return;
		}
		try {
			const hash = await hashJdText(jdText);
			matchedAnalysisId = recentAnalyses.find((a) => a.jd_hash === hash)?.id ?? null;
		} catch {
			matchedAnalysisId = null;
		}
	}

	function onJdTextInput() {
		if (jdHashTimer) clearTimeout(jdHashTimer);
		jdHashTimer = setTimeout(() => {
			void matchSavedJd();
			persistJdSession();
		}, 250);
	}

	function scheduleAcceptedPatch() {
		if (!sessionReady || !savedAnalysisId) return;
		persistJdSession();
		if (acceptedPatchTimer) clearTimeout(acceptedPatchTimer);
		const id = savedAnalysisId;
		const accepted = [...acceptedChanges];
		acceptedPatchTimer = setTimeout(() => {
			void patchJobAnalysisAccepted(id, accepted).catch(() => undefined);
		}, 400);
	}

	$: acceptedKey = [...acceptedChanges].sort().join(',');
	$: if (sessionReady && savedAnalysisId) {
		void acceptedKey;
		scheduleAcceptedPatch();
	}
	$: if (sessionReady) {
		void jdText;
		onJdTextInput();
	}

	function startFresh() {
		if (acceptedPatchTimer) {
			clearTimeout(acceptedPatchTimer);
			acceptedPatchTimer = null;
		}
		if (jdHashTimer) {
			clearTimeout(jdHashTimer);
			jdHashTimer = null;
		}
		jdText = '';
		jobAnalysis = null;
		acceptedChanges = new Set();
		savedAnalysisId = null;
		matchedAnalysisId = null;
		headline = '';
		bio = '';
		nameTouched = false;
		createOpen = false;
		clearJdSession();
		if (page.url.searchParams.has('analysis')) {
			void goto('/resume/tailor', { replaceState: true, keepFocus: true, noScroll: true });
		}
	}

	$: canStartFresh = Boolean(jdText.trim() || jobAnalysis);

	function buildSuggestedName(): string {
		return suggestedTailoredResumeName({ usedAi: jobAnalysis?.job.parse === 'llm' });
	}

	async function runAnalyze() {
		if (!jdText.trim()) {
			showToast('Paste a job description first', 'error');
			return;
		}
		analyzeBusy = true;
		jobAnalysis = null;
		try {
			jobAnalysis = await analyzeJob({
				jd_text: jdText.trim(),
				portfolio_id: portfolioId || undefined,
				enhance: enhanceParse && pro && !outOfAiUnits
			});
			acceptedChanges = defaultAcceptedIds(jobAnalysis);
			savedAnalysisId = jobAnalysis.id ?? null;
			await refreshRecentAnalyses();
			persistJdSession();
			void matchSavedJd();
			if (enhanceParse && pro) await refreshAiUsage();
			if (jobAnalysis.llm_skip_reason === 'units') {
				showToast(
					aiUsage
						? `Daily AI budget reached (${aiUsage.units}/${aiUsage.limit}). Used free heuristic parse.`
						: 'Daily AI budget reached. Used free heuristic parse.',
					'error'
				);
			} else {
				showToast('Fit analysis ready — saved to your account', 'success');
			}
			if (jobAnalysis.id) {
				void goto(`/resume/tailor?analysis=${encodeURIComponent(jobAnalysis.id)}`, {
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Analysis failed';
			try {
				const parsed = JSON.parse(msg) as { error?: string; message?: string };
				showToast(parsed.message || parsed.error || msg, 'error');
			} catch {
				showToast(msg, 'error');
			}
		} finally {
			analyzeBusy = false;
		}
	}

	function openCreateSheet() {
		if (!jobAnalysis) {
			showToast('Analyze the JD first', 'error');
			return;
		}
		createOpen = true;
	}

	function closeCreateSheet() {
		if (saving) return;
		createOpen = false;
	}

	function onCreateBackdrop(e: MouseEvent) {
		if (e.target === createDialog) closeCreateSheet();
	}

	async function createTailored() {
		if (!jobAnalysis) {
			showToast('Analyze the JD first', 'error');
			return;
		}
		if (!portfolioId) {
			showToast('Choose a folio', 'error');
			return;
		}
		const finalName = (nameTouched ? name : suggestedName).trim() || suggestedName;
		if (!finalName) {
			showToast('Resume name is required', 'error');
			return;
		}
		if (!jdText.trim()) {
			showToast('Paste a job description', 'error');
			return;
		}

		saving = true;
		try {
			const approved = jobAnalysis
				? approvedFromAnalysis(jobAnalysis, acceptedChanges)
				: undefined;
			if (jobAnalysis && approved && approved.skill_ids.length === 0) {
				showToast(
					'Accept at least one Library skill. Missing JD skills cannot be added.',
					'error'
				);
				saving = false;
				return;
			}
			const result = await tailorResume({
				name: finalName,
				portfolio_id: portfolioId,
				theme_slug: themeSlug,
				jd_text: jdText.trim(),
				include_matching: includeMatching,
				is_public: isPublic ? 1 : 0,
				headline: headline.trim() || undefined,
				bio: bio.trim() || undefined,
				approved
			});
			clearJdSession();
			showToast(
				`Resume created with ${result.matched_skill_ids.length} skill(s)`,
				'success'
			);
			await goto(`/resume?preview=${result.resume.id}`);
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
	title="Tailor to a job"
	description="Paste a JD and see how your library fits. Create a resume after you’re happy with the match."
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
			<div class="jd-wrap">
				<div class="jd-head">
					<span class="jd-label">Job description</span>
					{#if canStartFresh}
						<Button variant="secondary" disabled={analyzeBusy || saving} on:click={startFresh}>
							New JD
						</Button>
					{/if}
				</div>
				<Textarea
					bind:value={jdText}
					rows={10}
					placeholder="Paste the JD — we’ll match your Library, not invent skills…"
				/>
			</div>

			{#if pro}
				<label class="checkbox" class:dim={outOfAiUnits}>
					<input type="checkbox" bind:checked={enhanceParse} disabled={outOfAiUnits} />
					Smarter parse (1 AI unit)
				</label>
				{#if aiUsage}
					<p class="hint" class:warn={outOfAiUnits}>
						{#if outOfAiUnits}
							Daily AI budget used ({aiUsage.units}/{aiUsage.limit}). Heuristic parse is free —
							try again tomorrow.
						{:else}
							{aiUsage.remaining} of {aiUsage.limit} AI units left today · summary 1 · rewrite 1 ·
							import {aiUsage.costs.import}
						{/if}
					</p>
				{/if}
			{/if}
			{#if jobAnalysis}
				<JobAnalysisPanel analysis={jobAnalysis} bind:accepted={acceptedChanges} />
				<AiSummaryAssist
					bind:headline
					bind:bio
					{jdText}
					skillNames={summarySkillNames}
					{pro}
					outOfUnits={outOfAiUnits}
					unitsHint={aiUsage
						? `${aiUsage.remaining} of ${aiUsage.limit} AI units left today`
						: ''}
					disabled={analyzeBusy || saving}
					on:upgrade={(e) => showToast(e.detail, 'error')}
					on:generated={() => refreshAiUsage()}
				/>
			{/if}
			<div class="page-actions">
				<Button variant="secondary" disabled={analyzeBusy || saving} on:click={runAnalyze}>
					{analyzeBusy
						? 'Analyzing…'
						: jobAnalysis
							? 'Re-analyze'
							: 'Analyze fit'}
				</Button>
				{#if jobAnalysis}
					<span class="page-actions-primary">
						<Button disabled={saving} on:click={openCreateSheet}>Create tailored resume</Button>
					</span>
				{/if}
			</div>
		</div>
	</Card>

	<dialog
		bind:this={createDialog}
		class="sheet"
		aria-labelledby="create-sheet-title"
		on:cancel|preventDefault={closeCreateSheet}
		on:click={onCreateBackdrop}
	>
		<div class="sheet-inner">
			<div class="sheet-handle" aria-hidden="true"></div>
			<h2 id="create-sheet-title">Create tailored resume</h2>
			<p class="hint">Pick how to generate it — this does not change the analysis.</p>
			<div class="fields">
				<label class="field">
					<span class="label">From folio</span>
					<select bind:value={portfolioId}>
						{#each portfolios as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
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

				<label class="checkbox">
					<input type="checkbox" bind:checked={includeMatching} />
					Include matching experience &amp; projects
				</label>

				{#if headline.trim() || bio.trim()}
					<div class="summary-preview">
						<span class="label">Resume summary</span>
						{#if headline.trim()}
							<p class="summary-headline">{headline.trim()}</p>
						{/if}
						{#if bio.trim()}
							<p class="summary-bio">{bio.trim()}</p>
						{/if}
					</div>
				{/if}
			</div>
			<div class="sheet-actions">
				<Button variant="ghost" disabled={saving} on:click={closeCreateSheet}>Cancel</Button>
				<Button disabled={saving} on:click={createTailored}>
					{saving ? 'Creating…' : 'Generate resume'}
				</Button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.jd-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.25rem;
	}
	.jd-label {
		font-size: 0.875rem;
		font-weight: 500;
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
	.hint.warn {
		color: #92400e;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.checkbox.dim {
		opacity: 0.6;
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
	.muted {
		color: var(--color-muted);
	}
	.page-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-border);
	}
	.page-actions-primary {
		margin-left: auto;
	}
	dialog.sheet {
		width: min(32rem, 100%);
		max-height: min(92vh, 44rem);
		margin: auto auto 0;
		border: 1px solid var(--color-border);
		border-radius: 16px 16px 0 0;
		padding: 0;
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 -12px 40px rgba(26, 26, 46, 0.18);
	}
	dialog.sheet::backdrop {
		background: rgba(15, 23, 42, 0.4);
	}
	.sheet-inner {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.65rem 1.15rem 1.15rem;
		overflow: auto;
		max-height: min(92vh, 44rem);
	}
	.sheet-handle {
		width: 2.5rem;
		height: 0.28rem;
		border-radius: 99px;
		background: var(--color-border);
		margin: 0.15rem auto 0.25rem;
	}
	.sheet-inner h2 {
		margin: 0;
		font-size: 1.05rem;
	}
	.sheet-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.summary-preview {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.summary-headline {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
	}
	.summary-bio {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--color-muted);
		white-space: pre-wrap;
	}
</style>
