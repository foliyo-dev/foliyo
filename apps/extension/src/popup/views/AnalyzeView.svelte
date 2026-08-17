<script lang="ts">
  import { onMount } from "svelte";
  import JobAnalysisPanel from "@foliyo/ui/JobAnalysisPanel.svelte";
  import {
    approvedFromAnalysis,
    defaultAcceptedIds,
    suggestedTailoredResumeName,
    type JobAnalysis,
    type JobAnalysisSummary,
  } from "@foliyo/jobs-client";
  import ExistingResumeCard from "../components/ExistingResumeCard.svelte";
  import {
    analyzeJob,
    downloadFio,
    getAiUsage,
    getResumeContent,
    getSavedJobAnalysis,
    listJobAnalyses,
    parseApiMessage,
    parseUpgradeError,
    patchJobAnalysisAccepted,
    tailorResume,
    type AiUsage,
    type PlanInfo,
    type Resume,
  } from "../../api";
  import {
    APP_BASE,
    appUrl,
    isProPlan,
    RESUME_THEMES,
    type ResumeTheme,
  } from "../../config";
  import {
    hashJdText,
    matchSkillIdsFromJd,
    overlapRatio,
  } from "../../jd-cache";
  import {
    loadJdDraft,
    loadJdResumeCache,
    saveJdDraft,
    saveJdResumeCacheEntry,
    type ExtSettings,
  } from "../../storage";

  export let settings: ExtSettings;
  export let planInfo: PlanInfo | null;
  export let portfolios: Array<{ id: string; name: string }>;
  export let skills: Array<{ id: string; name: string; level: string }>;
  export let resumes: Resume[];
  export let onPrefsChange: (p: { portfolioId?: string; themeSlug?: string }) => void | Promise<void>;
  export let onResumeCreated: () => void | Promise<void>;
  export let pendingAnalysisId: string | null = null;
  export let onPendingConsumed: () => void = () => undefined;

  let portfolioId = "";
  let themeSlug: ResumeTheme = "classic";
  let jdText = "";
  let includeMatching = true;
  let enhanceParse = false;
  let name = "";
  let nameTouched = false;

  let analysis: JobAnalysis | null = null;
  let acceptedChanges = new Set<string>();
  let analyzeBusy = false;
  let createBusy = false;
  let error = "";
  let success = "";
  let isPublic = false;
  let createOpen = false;
  let createDialog: HTMLDialogElement | undefined;
  let savedAnalysisId: string | null = null;
  let recentAnalyses: JobAnalysisSummary[] = [];
  let matchedAnalysisId: string | null = null;
  let sessionReady = false;
  let acceptedPatchTimer: ReturnType<typeof setTimeout> | null = null;
  let aiUsage: AiUsage | null = null;

  $: pro = isProPlan(planInfo?.plan);
  $: analyzeCost = aiUsage?.costs.analyze ?? 1;
  $: outOfAiUnits = aiUsage != null && aiUsage.remaining < analyzeCost;

  let cachedSuggestion: { resumeId: string; name: string; reason: string } | null = null;
  let heuristicSuggestion: { resumeId: string; name: string; reason: string } | null = null;

  let lastCreated: { id: string; name: string } | null = null;

  $: suggestedName = suggestedTailoredResumeName({
    usedAi: analysis?.job.parse === "llm",
  });
  $: if (!nameTouched) name = suggestedName;
  $: suggestion = cachedSuggestion ?? heuristicSuggestion;

  function persistDraft() {
    void saveJdDraft({
      jdText,
      analysisId: savedAnalysisId,
      accepted: [...acceptedChanges],
      enhanceParse,
      showDetails: true,
    });
  }

  async function refreshAiUsage() {
    try {
      aiUsage = await getAiUsage(settings);
    } catch {
      aiUsage = null;
    }
  }

  async function refreshRecents() {
    try {
      const { items } = await listJobAnalyses(settings);
      recentAnalyses = items;
    } catch {
      recentAnalyses = [];
    }
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

  async function openSaved(id: string, acceptedOverride?: string[]) {
    const saved = await getSavedJobAnalysis(id, settings);
    savedAnalysisId = saved.id;
    analysis = saved.analysis;
    jdText = saved.jd_text;
    acceptedChanges = new Set(acceptedOverride?.length ? acceptedOverride : saved.accepted);
    if (acceptedChanges.size === 0) acceptedChanges = defaultAcceptedIds(saved.analysis);
    persistDraft();
  }

  function scheduleAcceptedPatch() {
    if (!sessionReady || !savedAnalysisId) return;
    persistDraft();
    if (acceptedPatchTimer) clearTimeout(acceptedPatchTimer);
    const id = savedAnalysisId;
    const accepted = [...acceptedChanges];
    acceptedPatchTimer = setTimeout(() => {
      void patchJobAnalysisAccepted(id, accepted, settings).catch(() => undefined);
    }, 400);
  }

  onMount(async () => {
    await Promise.all([refreshRecents(), refreshAiUsage()]);
    const draft = await loadJdDraft();
    if (draft) {
      if (draft.jdText) jdText = draft.jdText;
      enhanceParse = draft.enhanceParse;
      if (pendingAnalysisId) {
        try {
          await openSaved(pendingAnalysisId);
        } catch {
          savedAnalysisId = null;
          analysis = null;
        }
        onPendingConsumed();
      } else if (draft.analysisId) {
        try {
          await openSaved(draft.analysisId, draft.accepted);
        } catch {
          savedAnalysisId = null;
          analysis = null;
        }
      }
    } else if (pendingAnalysisId) {
      try {
        await openSaved(pendingAnalysisId);
      } catch {
        savedAnalysisId = null;
        analysis = null;
      }
      onPendingConsumed();
    }
    sessionReady = true;
    await checkJdCache();
    void matchSavedJd();
  });

  $: acceptedKey = [...acceptedChanges].sort().join(",");
  $: if (sessionReady && savedAnalysisId) {
    void acceptedKey;
    scheduleAcceptedPatch();
  }

  async function onPortfolioChange() {
    await onPrefsChange({ portfolioId });
    await checkJdCache();
    heuristicSuggestion = null;
  }

  async function onThemeChange() {
    await onPrefsChange({ themeSlug });
  }

  async function checkJdCache() {
    if (!jdText.trim() || !portfolioId) {
      cachedSuggestion = null;
      return;
    }
    const hash = await hashJdText(jdText);
    const cache = await loadJdResumeCache();
    const entry = cache[hash];
    if (entry && entry.portfolioId === portfolioId) {
      cachedSuggestion = {
        resumeId: entry.resumeId,
        name: entry.name,
        reason: "You created this resume for the same job description earlier.",
      };
    } else {
      cachedSuggestion = null;
    }
  }

  async function onJdInput() {
    persistDraft();
    await checkJdCache();
    heuristicSuggestion = null;
    void matchSavedJd();
  }

  function startFresh() {
    if (acceptedPatchTimer) {
      clearTimeout(acceptedPatchTimer);
      acceptedPatchTimer = null;
    }
    jdText = "";
    analysis = null;
    acceptedChanges = new Set();
    savedAnalysisId = null;
    matchedAnalysisId = null;
    nameTouched = false;
    isPublic = false;
    closeCreateSheet();
    error = "";
    success = "";
    lastCreated = null;
    cachedSuggestion = null;
    heuristicSuggestion = null;
    persistDraft();
  }

  $: canStartFresh = Boolean(jdText.trim() || analysis);

  async function runHeuristicMatch() {
    if (!jdText.trim() || !portfolioId) return;
    const jdMatched = new Set(matchSkillIdsFromJd(jdText, skills));
    if (jdMatched.size === 0) return;

    const candidates = resumes
      .filter((r) => r.portfolio_id === portfolioId)
      .slice(0, 5);

    let best: { resume: Resume; ratio: number } | null = null;
    for (const resume of candidates) {
      try {
        const content = await getResumeContent(resume.id, settings);
        const resumeSkills = new Set(content.skill_ids);
        const ratio = overlapRatio(jdMatched, resumeSkills);
        if (ratio >= 0.8 && (!best || ratio > best.ratio)) {
          best = { resume, ratio };
        }
      } catch {
        /* skip */
      }
    }
    if (best) {
      heuristicSuggestion = {
        resumeId: best.resume.id,
        name: best.resume.name,
        reason: `Matches ${Math.round(best.ratio * 100)}% of JD skills in your library.`,
      };
    }
  }

  async function runAnalyze() {
    error = "";
    success = "";
    if (!jdText.trim()) {
      error = "Paste a job description first.";
      return;
    }
    analyzeBusy = true;
    analysis = null;
    heuristicSuggestion = null;
    try {
      analysis = await analyzeJob(
        {
          jd_text: jdText.trim(),
          portfolio_id: portfolioId || undefined,
          enhance: enhanceParse && pro && !outOfAiUnits,
        },
        settings,
      );
      acceptedChanges = defaultAcceptedIds(analysis);
      savedAnalysisId = analysis.id ?? null;
      await refreshRecents();
      persistDraft();
      void matchSavedJd();
      if (enhanceParse && pro) await refreshAiUsage();
      if (analysis.llm_skip_reason === "units") {
        error = aiUsage
          ? `Daily AI budget reached (${aiUsage.units}/${aiUsage.limit}). Used free heuristic parse.`
          : "Daily AI budget reached. Used free heuristic parse.";
      }
      await runHeuristicMatch();
    } catch (err) {
      const upgrade = parseUpgradeError(err);
      error = upgrade?.message ?? parseApiMessage(err);
    } finally {
      analyzeBusy = false;
    }
  }

  $: if (createDialog) {
    if (createOpen && !createDialog.open) createDialog.showModal();
    if (!createOpen && createDialog.open) createDialog.close();
  }

  function openCreateSheet() {
    if (!analysis) {
      error = "Analyze the JD first.";
      return;
    }
    error = "";
    createOpen = true;
  }

  function closeCreateSheet() {
    if (createBusy) return;
    createOpen = false;
  }

  function onCreateBackdrop(e: MouseEvent) {
    if (e.target === createDialog) closeCreateSheet();
  }

  async function createResume() {
    error = "";
    success = "";
    if (!portfolioId) {
      error = "Choose a portfolio.";
      return;
    }
    if (!jdText.trim()) {
      error = "Paste a job description.";
      return;
    }
    const finalName = (nameTouched ? name : suggestedName).trim() || suggestedName;
    const approved = analysis ? approvedFromAnalysis(analysis, acceptedChanges) : undefined;
    if (analysis && approved && approved.skill_ids.length === 0) {
      error = "Accept at least one Library skill. Missing JD skills cannot be added.";
      return;
    }

    createBusy = true;
    try {
      const out = await tailorResume(
        {
          name: finalName,
          portfolio_id: portfolioId,
          theme_slug: themeSlug,
          jd_text: jdText.trim(),
          include_matching: includeMatching,
          is_public: isPublic ? 1 : 0,
          approved,
        },
        settings,
      );
      lastCreated = { id: out.resume.id, name: out.resume.name };
      success = `Resume created with ${out.matched_skill_ids.length} skill(s).`;
      const hash = await hashJdText(jdText);
      await saveJdResumeCacheEntry(hash, {
        resumeId: out.resume.id,
        portfolioId,
        name: out.resume.name,
        createdAt: new Date().toISOString(),
      });
      cachedSuggestion = {
        resumeId: out.resume.id,
        name: out.resume.name,
        reason: "Just created for this job description.",
      };
      await onResumeCreated();
      createOpen = false;
    } catch (err) {
      const upgrade = parseUpgradeError(err);
      if (upgrade) {
        error = `${upgrade.message} Upgrade at ${appUrl("/settings")}`;
      } else {
        error = parseApiMessage(err);
      }
    } finally {
      createBusy = false;
    }
  }

  async function downloadLast() {
    if (!lastCreated) return;
    try {
      await downloadFio(lastCreated.id, lastCreated.name, settings);
    } catch (err) {
      error = parseApiMessage(err);
    }
  }

  $: if (settings.portfolioId) portfolioId = settings.portfolioId;
  else if (!portfolioId && portfolios[0]) portfolioId = portfolios[0].id;
  $: themeSlug = (settings.themeSlug as ResumeTheme) ?? "classic";
</script>

<div class="tailor-view">
<div class="card tailor-card">
  <div class="tailor-body">
  <h2 class="section-title">Tailor to a job</h2>
  <p class="hint">
    Paste a JD and see how your library fits. Create a resume after you’re happy with the match.
    <a href={appUrl("/resume/tailor")} target="_blank" rel="noreferrer">Open in Foliyo</a>
  </p>

  <div class="fields">
    <div class="field">
      <div class="label-row">
        <span class="label">Job description</span>
        {#if canStartFresh}
          <button
            type="button"
            class="btn secondary inline"
            disabled={analyzeBusy || createBusy}
            on:click={startFresh}
          >
            New JD
          </button>
        {/if}
      </div>
      <textarea
        rows="8"
        aria-label="Job description"
        placeholder="Paste the JD — we’ll match your Library, not invent skills…"
        bind:value={jdText}
        on:input={() => {
          onJdInput();
        }}
      ></textarea>
      <span class="field-hint">Saved to your Foliyo account. Reopening the popup restores it.</span>
    </div>

    {#if matchedAnalysisId && matchedAnalysisId !== savedAnalysisId}
      <button
        type="button"
        class="linkish"
        on:click={() => {
          if (matchedAnalysisId) void openSaved(matchedAnalysisId);
        }}
      >
        Reuse saved analysis for this JD — no extra unit
      </button>
    {/if}

    {#if pro}
      <label class="check">
        <input type="checkbox" bind:checked={enhanceParse} disabled={outOfAiUnits} />
        Smarter parse (1 AI unit)
      </label>
      {#if aiUsage}
        <span class="field-hint" class:warn={outOfAiUnits}>
          {#if outOfAiUnits}
            Daily AI budget used ({aiUsage.units}/{aiUsage.limit}). Heuristic parse is free — try again tomorrow.
          {:else}
            {aiUsage.remaining} of {aiUsage.limit} AI units left today
          {/if}
        </span>
      {/if}
    {/if}

    {#if suggestion}
      <ExistingResumeCard
        settings={settings}
        resumeId={suggestion.resumeId}
        name={suggestion.name}
        reason={suggestion.reason}
      />
    {/if}

    {#if analysis}
      <JobAnalysisPanel
        analysis={analysis}
        bind:accepted={acceptedChanges}
        skillsBaseUrl={APP_BASE}
      />
    {/if}

    {#if lastCreated}
      <div class="suggest-card">
        <p class="ok">{success}</p>
        <div class="btn-row">
          <button type="button" class="btn" on:click={downloadLast}>Download .fio</button>
          <a class="btn ghost" href={appUrl("/resume")} target="_blank" rel="noreferrer">Open resume in Foliyo</a>
        </div>
      </div>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
    </div>
  </div>

    <div class="page-actions">
      <button type="button" class="btn secondary" disabled={analyzeBusy || createBusy} on:click={runAnalyze}>
        {analyzeBusy ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze fit"}
      </button>
      {#if analysis}
        <span class="page-actions-primary">
          <button type="button" class="btn" disabled={createBusy} on:click={openCreateSheet}>
            Create tailored resume
          </button>
        </span>
      {/if}
    </div>
</div>

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
        <select
          bind:value={portfolioId}
          on:change={() => {
            onPortfolioChange();
          }}
        >
          {#each portfolios as p (p.id)}
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
          <span class="field-hint">Suggested: {suggestedName}</span>
        {/if}
      </label>

      <label class="field">
        <span class="label">Theme</span>
        <select
          bind:value={themeSlug}
          on:change={() => {
            onThemeChange();
          }}
        >
          {#each RESUME_THEMES as t (t)}
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
        <button type="button" class="mode-option" class:on={isPublic} on:click={() => (isPublic = true)}>
          Public
        </button>
      </div>

      <label class="check">
        <input type="checkbox" bind:checked={includeMatching} />
        Include matching experience &amp; projects
      </label>
    </div>
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <div class="sheet-actions">
      <button type="button" class="btn ghost" disabled={createBusy} on:click={closeCreateSheet}>Cancel</button>
      <button type="button" class="btn" disabled={createBusy} on:click={createResume}>
        {createBusy ? "Creating…" : "Generate resume"}
      </button>
    </div>
  </div>
</dialog>
</div>
