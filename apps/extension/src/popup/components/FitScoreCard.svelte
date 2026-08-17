<script lang="ts">
  import type { JobAnalysis } from "@foliyo/jobs-client";
  import CoverageHero from "@foliyo/ui/CoverageHero.svelte";

  let { analysis }: { analysis: JobAnalysis } = $props();
</script>

<div class="fit-card">
  <CoverageHero {analysis} compact />
</div>

<style>
  .fit-card {
    margin-top: 10px;
    padding: 10px 12px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-bg) 60%, var(--color-surface));
  }
</style>
