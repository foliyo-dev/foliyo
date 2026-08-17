<script lang="ts">
  import { downloadFio } from "../../api";
  import { appUrl } from "../../config";
  import type { ExtSettings } from "../../storage";

  export let settings: ExtSettings;
  export let resumeId: string;
  export let name: string;
  export let reason: string;

  let downloading = false;
  let error = "";

  async function download() {
    downloading = true;
    error = "";
    try {
      await downloadFio(resumeId, name, settings);
    } catch (err) {
      error = err instanceof Error ? err.message : "Download failed";
    } finally {
      downloading = false;
    }
  }
</script>

<div class="suggest-card">
  <p><strong>Already tailored:</strong> {name}</p>
  <p class="hint">{reason}</p>
  <div class="btn-row">
    <button type="button" class="btn" disabled={downloading} on:click={download}>
      {downloading ? "Downloading…" : "Download .fio"}
    </button>
    <a class="btn ghost" href={appUrl("/resume")} target="_blank" rel="noreferrer">Open in Foliyo</a>
  </div>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>
