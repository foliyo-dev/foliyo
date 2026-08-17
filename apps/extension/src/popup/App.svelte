<script lang="ts">
  import { onMount } from "svelte";
  import TabBar from "./components/TabBar.svelte";
  import PlanBadge from "./components/PlanBadge.svelte";
  import LoginView from "./views/LoginView.svelte";
  import AnalyzeView from "./views/AnalyzeView.svelte";
  import AnalysesView from "./views/AnalysesView.svelte";
  import CreateView from "./views/CreateView.svelte";
  import ResumesView from "./views/ResumesView.svelte";
  import {
    clearSession,
    loadSettings,
    saveSettings,
    type ExtSettings,
  } from "../storage";
  import {
    getPlan,
    listPortfolios,
    listResumes,
    listSkills,
    me,
    parseApiMessage,
    type PlanInfo,
    type Resume,
  } from "../api";

  type Tab = "analyze" | "history" | "resumes" | "create";

  let loading = true;
  let loggedIn = false;
  let settings: ExtSettings = { apiBase: "", token: null, email: null, portfolioId: null, themeSlug: "classic" };
  let planInfo: PlanInfo | null = null;
  let portfolios: Array<{ id: string; name: string }> = [];
  let skills: Array<{ id: string; name: string; level: string }> = [];
  let resumes: Resume[] = [];
  let tab: Tab = "analyze";
  let pendingAnalysisId: string | null = null;
  let bootError = "";

  async function loadAppData() {
    const [plan, p, sk, res] = await Promise.all([
      getPlan(settings).catch(() => null),
      listPortfolios(settings),
      listSkills(settings),
      listResumes(settings),
    ]);
    planInfo = plan;
    portfolios = p;
    skills = sk;
    resumes = res;
    if (!settings.portfolioId && portfolios[0]) {
      settings = { ...settings, portfolioId: portfolios[0].id };
      await saveSettings({ portfolioId: portfolios[0].id });
    }
  }

  async function restoreSession() {
    loading = true;
    bootError = "";
    settings = await loadSettings();
    if (!settings.token) {
      loggedIn = false;
      loading = false;
      return;
    }
    try {
      const res = await me(settings);
      settings = { ...settings, email: res.user.email };
      await saveSettings({ email: res.user.email });
      loggedIn = true;
      await loadAppData();
    } catch {
      await clearSession();
      settings = { ...settings, token: null };
      loggedIn = false;
      bootError = "Session expired — sign in again.";
    } finally {
      loading = false;
    }
  }

  async function onLogin(email: string) {
    settings = await loadSettings();
    loggedIn = true;
    bootError = "";
    await loadAppData();
  }

  async function onLogout() {
    await clearSession();
    settings = { ...settings, token: null };
    loggedIn = false;
    planInfo = null;
    portfolios = [];
    skills = [];
    resumes = [];
    tab = "analyze";
  }

  function openSavedAnalysis(id: string) {
    pendingAnalysisId = id;
    tab = "analyze";
  }

  async function refreshResumes() {
    resumes = await listResumes(settings);
  }

  async function onPrefsChange(partial: { portfolioId?: string; themeSlug?: string }) {
    if (partial.portfolioId) {
      settings = { ...settings, portfolioId: partial.portfolioId };
      await saveSettings({ portfolioId: partial.portfolioId });
    }
    if (partial.themeSlug) {
      settings = { ...settings, themeSlug: partial.themeSlug };
      await saveSettings({ themeSlug: partial.themeSlug });
    }
  }

  onMount(() => {
    void restoreSession();
  });
</script>

<main class="app">
  <header class="top">
    <div class="brand">
      <img src="icons/icon32.png" width="22" height="22" alt="" />
      <div>
        <strong>Foliyo</strong>
        <p class="sub">Tailor resumes to any job</p>
      </div>
    </div>
    {#if loggedIn}
      <div class="session">
        <PlanBadge planInfo={planInfo} />
        <span class="session-email">{settings.email}</span>
        <button type="button" class="linkish" on:click={onLogout}>Sign out</button>
      </div>
    {/if}
  </header>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if !loggedIn}
    <div class="app-scroll">
      <LoginView onLogin={onLogin} initialError={bootError} />
    </div>
  {:else}
    <TabBar tab={tab} onTab={(t) => (tab = t)} />
    <div class="app-scroll">
      {#if tab === "analyze"}
        <AnalyzeView
          settings={settings}
          planInfo={planInfo}
          portfolios={portfolios}
          skills={skills}
          resumes={resumes}
          pendingAnalysisId={pendingAnalysisId}
          onPendingConsumed={() => (pendingAnalysisId = null)}
          onPrefsChange={onPrefsChange}
          onResumeCreated={refreshResumes}
        />
      {:else if tab === "history"}
        <AnalysesView
          settings={settings}
          onOpen={openSavedAnalysis}
          onGoTailor={() => (tab = "analyze")}
        />
      {:else if tab === "create"}
        <CreateView
          settings={settings}
          portfolios={portfolios}
          skills={skills}
          onPrefsChange={onPrefsChange}
          onResumeCreated={refreshResumes}
        />
      {:else}
        <ResumesView
          settings={settings}
          resumes={resumes}
          portfolios={portfolios}
          onGoAnalyze={() => (tab = "analyze")}
          onRefresh={refreshResumes}
        />
      {/if}
    </div>
  {/if}
</main>
