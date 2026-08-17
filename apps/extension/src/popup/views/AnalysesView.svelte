<script lang="ts">
  import { onMount } from "svelte";
  import RecentAnalyses from "@foliyo/ui/RecentAnalyses.svelte";
  import { listJobAnalyses, parseApiMessage } from "../../api";
  import { appUrl } from "../../config";
  import type { ExtSettings } from "../../storage";
  import type { JobAnalysisSummary } from "@foliyo/jobs-client";

  export let settings: ExtSettings;
  export let onOpen: (id: string) => void;
  export let onGoTailor: () => void;

  let items: JobAnalysisSummary[] = [];
  let loading = true;
  let error = "";

  async function load() {
    loading = true;
    error = "";
    try {
      const { items: recents } = await listJobAnalyses(settings);
      items = recents;
    } catch (err) {
      items = [];
      error = parseApiMessage(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="card">
  <div class="skills-tools">
    <h2 class="section-title">JD history</h2>
    <button type="button" class="linkish" disabled={loading} on:click={() => load()}>Refresh</button>
  </div>
  <p class="hint">Saved fit analyses. Opening one does not use your daily AI units.</p>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if items.length}
    <RecentAnalyses items={items} showIntro={false} onSelect={onOpen} />
  {:else}
    <p class="hint">No saved analyses yet.</p>
    <button type="button" class="linkish" on:click={onGoTailor}>Tailor a job →</button>
  {/if}

  <p class="field-hint">
    <a href={appUrl("/resume/analyses")} target="_blank" rel="noreferrer">Open in Foliyo</a>
  </p>
</div>
