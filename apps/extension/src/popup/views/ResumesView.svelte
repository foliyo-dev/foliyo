<script lang="ts">
  import { downloadFio, parseApiMessage, type Resume } from "../../api";
  import { appUrl } from "../../config";
  import type { ExtSettings } from "../../storage";

  export let settings: ExtSettings;
  export let resumes: Resume[];
  export let portfolios: Array<{ id: string; name: string }>;
  export let onGoAnalyze: () => void;
  export let onRefresh: () => void | Promise<void>;

  let downloadingId: string | null = null;
  let error = "";

  $: recent = resumes.slice(0, 10);

  function portfolioName(id: string | null): string {
    if (!id) return "—";
    return portfolios.find((p) => p.id === id)?.name ?? "Portfolio";
  }

  function formatDate(raw?: string): string {
    if (!raw) return "";
    try {
      return new Date(raw).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return raw;
    }
  }

  async function download(resume: Resume) {
    downloadingId = resume.id;
    error = "";
    try {
      await downloadFio(resume.id, resume.name, settings);
    } catch (err) {
      error = parseApiMessage(err);
    } finally {
      downloadingId = null;
    }
  }
</script>

<div class="card">
  <div class="skills-tools">
    <h2 class="section-title">Recent resumes</h2>
    <button type="button" class="linkish" on:click={onRefresh}>Refresh</button>
  </div>

  {#if recent.length === 0}
    <p class="hint">No resumes yet.</p>
    <button type="button" class="linkish" on:click={onGoAnalyze}>Tailor a job →</button>
  {:else}
    <ul class="resume-list">
      {#each recent as resume (resume.id)}
        <li class="resume-item">
          <div class="resume-item-head">
            <div>
              <div class="resume-name">{resume.name}</div>
              <div class="resume-meta">
                {portfolioName(resume.portfolio_id)} · {resume.theme_slug}
                {#if resume.created_at}
                  · {formatDate(resume.created_at)}
                {/if}
              </div>
            </div>
          </div>
          <div class="resume-actions">
            <button
              type="button"
              class="linkish"
              disabled={downloadingId === resume.id}
              on:click={() => download(resume)}
            >
              {downloadingId === resume.id ? "Downloading…" : "Download .fio"}
            </button>
            <a class="linkish" href={appUrl("/resume")} target="_blank" rel="noreferrer">Open in Foliyo</a>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>
