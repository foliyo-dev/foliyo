<script lang="ts">
  import SkillChips from "../components/SkillChips.svelte";
  import LibraryExpandPicker from "../components/LibraryExpandPicker.svelte";
  import {
    createResume,
    downloadFio,
    listCertifications,
    listEducation,
    listExperience,
    listLanguages,
    listProjects,
    parseApiMessage,
    parseUpgradeError,
    tailorResume,
  } from "../../api";
  import {
    appUrl,
    monthYear,
    RESUME_THEMES,
    type ResumeTheme,
  } from "../../config";
  import type { ExtSettings } from "../../storage";

  export let settings: ExtSettings;
  export let portfolios: Array<{ id: string; name: string }>;
  export let skills: Array<{ id: string; name: string; level: string }>;
  export let onPrefsChange: (p: { portfolioId?: string; themeSlug?: string }) => void | Promise<void>;
  export let onResumeCreated: () => void | Promise<void>;

  let portfolioId = "";
  let themeSlug: ResumeTheme = "classic";
  $: if (settings.portfolioId) portfolioId = settings.portfolioId;
  else if (!portfolioId && portfolios[0]) portfolioId = portfolios[0].id;
  $: themeSlug = (settings.themeSlug as ResumeTheme) ?? "classic";
  let includeMatching = true;
  let name = "";
  let nameTouched = false;

  let selectedSkills = new Set<string>();
  let selectedProjects = new Set<string>();
  let selectedExperience = new Set<string>();
  let selectedEducation = new Set<string>();
  let selectedCertifications = new Set<string>();
  let selectedLanguages = new Set<string>();

  let projects: Array<{ id: string; title: string }> = [];
  let experiences: Array<{ id: string; company: string; role: string }> = [];
  let educations: Array<{ id: string; institution: string; degree: string }> = [];
  let certifications: Array<{ id: string; name: string; issuer: string }> = [];
  let languages: Array<{ id: string; name: string; proficiency: string }> = [];
  let libraryLoaded = false;

  let busy = false;
  let error = "";
  let lastCreated: { id: string; name: string } | null = null;

  $: portfolioName = portfolios.find((p) => p.id === portfolioId)?.name ?? "Resume";
  $: customCount =
    selectedSkills.size +
    selectedProjects.size +
    selectedExperience.size +
    selectedEducation.size +
    selectedCertifications.size +
    selectedLanguages.size;
  $: suggestedName =
    customCount > 0
      ? `${portfolioName} · Custom (${customCount}) — ${monthYear()}`
      : `${portfolioName} — ${monthYear()}`;
  $: if (!nameTouched) name = suggestedName;
  $: summaryParts = [
    selectedProjects.size > 0 ? `${selectedProjects.size} project(s)` : "",
    selectedExperience.size > 0 ? `${selectedExperience.size} role(s)` : "",
    selectedEducation.size > 0 ? `${selectedEducation.size} education` : "",
    selectedCertifications.size > 0 ? `${selectedCertifications.size} cert(s)` : "",
    selectedLanguages.size > 0 ? `${selectedLanguages.size} language(s)` : "",
  ].filter(Boolean);

  async function loadLibrary() {
    if (libraryLoaded) return;
    try {
      const [pr, ex, ed, cert, lang] = await Promise.all([
        listProjects(settings),
        listExperience(settings),
        listEducation(settings),
        listCertifications(settings),
        listLanguages(settings),
      ]);
      projects = pr;
      experiences = ex;
      educations = ed;
      certifications = cert;
      languages = lang;
      libraryLoaded = true;
    } catch {
      error = "Failed to load library items.";
    }
  }

  async function onPortfolioChange() {
    await onPrefsChange({ portfolioId });
  }

  async function onThemeChange() {
    await onPrefsChange({ themeSlug });
  }

  async function submit() {
    error = "";
    if (!portfolioId) {
      error = "Choose a portfolio.";
      return;
    }
    if (selectedSkills.size === 0 && customCount === 0) {
      error = "Select at least one skill or library item.";
      return;
    }
    const finalName = (nameTouched ? name : suggestedName).trim() || suggestedName;
    busy = true;
    try {
      const hasExplicit =
        selectedProjects.size > 0 ||
        selectedExperience.size > 0 ||
        selectedEducation.size > 0 ||
        selectedCertifications.size > 0 ||
        selectedLanguages.size > 0;

      if (hasExplicit) {
        const items = await createResume(
          {
            name: finalName,
            portfolio_id: portfolioId,
            theme_slug: themeSlug,
            content: {
              skill_ids: [...selectedSkills],
              project_ids: [...selectedProjects],
              experience_ids: [...selectedExperience],
              education_ids: [...selectedEducation],
              certification_ids: [...selectedCertifications],
              language_ids: [...selectedLanguages],
            },
          },
          settings,
        );
        const newest = items[0];
        if (newest) lastCreated = { id: newest.id, name: newest.name };
      } else {
        const out = await tailorResume(
          {
            name: finalName,
            portfolio_id: portfolioId,
            theme_slug: themeSlug,
            skill_ids: [...selectedSkills],
            include_matching: includeMatching,
          },
          settings,
        );
        lastCreated = { id: out.resume.id, name: out.resume.name };
      }
      await onResumeCreated();
    } catch (err) {
      const upgrade = parseUpgradeError(err);
      if (upgrade) {
        error = `${upgrade.message} Upgrade at ${appUrl("/settings")}`;
      } else {
        error = parseApiMessage(err);
      }
    } finally {
      busy = false;
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
</script>

<div class="card">
  <h2 class="section-title">Create manually</h2>
  <p class="hint">Pick skills and optionally expand to other library items.</p>

  <div class="fields">
    <label class="field">
      <span class="label">Portfolio</span>
      <select bind:value={portfolioId} on:change={onPortfolioChange}>
        {#each portfolios as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>

    <label class="field">
      <span class="label">Theme</span>
      <select bind:value={themeSlug} on:change={onThemeChange}>
        {#each RESUME_THEMES as t}
          <option value={t}>{t}</option>
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

    <div class="field">
      <span class="label">Skills</span>
      <SkillChips
        skills={skills}
        selected={selectedSkills}
        onChange={(s) => (selectedSkills = s)}
      />
    </div>

    {#if summaryParts.length}
      <p class="hint">Also including: {summaryParts.join(", ")}</p>
    {/if}

    <label class="check">
      <input type="checkbox" bind:checked={includeMatching} />
      Include matching experience & projects (skills-only create)
    </label>

    <button type="button" class="linkish" on:click={loadLibrary}>Load more library items…</button>

    {#if libraryLoaded}
      <LibraryExpandPicker
        projects={projects}
        experiences={experiences}
        educations={educations}
        certifications={certifications}
        languages={languages}
        selectedProjects={selectedProjects}
        selectedExperience={selectedExperience}
        selectedEducation={selectedEducation}
        selectedCertifications={selectedCertifications}
        selectedLanguages={selectedLanguages}
        onProjectsChange={(s) => (selectedProjects = s)}
        onExperienceChange={(s) => (selectedExperience = s)}
        onEducationChange={(s) => (selectedEducation = s)}
        onCertificationsChange={(s) => (selectedCertifications = s)}
        onLanguagesChange={(s) => (selectedLanguages = s)}
      />
    {/if}
  </div>

  <div class="form-actions">
    <button type="button" class="btn" disabled={busy} on:click={submit}>
      {busy ? "Creating…" : "Create resume"}
    </button>
  </div>

  {#if lastCreated}
    <div class="suggest-card">
      <p class="ok">Resume “{lastCreated.name}” created.</p>
      <div class="btn-row">
        <button type="button" class="btn" on:click={downloadLast}>Download .fio</button>
        <a class="btn ghost" href={appUrl("/resume")} target="_blank" rel="noreferrer">Open in Foliyo</a>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>
