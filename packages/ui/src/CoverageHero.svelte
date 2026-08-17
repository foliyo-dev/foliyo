<script lang="ts">
  import type { JobAnalysis } from "@foliyo/jobs-client";
  import { popupBands } from "@foliyo/jobs-client";

  let { analysis, compact = false }: { analysis: JobAnalysis; compact?: boolean } = $props();

  const bands = $derived(popupBands(analysis.matches));
  const strongN = $derived(bands.strong.length);
  const partialN = $derived(bands.partial.length);
  const missingN = $derived(bands.missing.length);
  const inLibrary = $derived(strongN + partialN);
  const total = $derived(inLibrary + missingN);
  const fit = $derived.by(() => {
    if (total <= 0) return "unknown";
    const ratio = inLibrary / total;
    if (ratio >= 0.7) return "strong";
    if (ratio >= 0.4) return "partial";
    return "weak";
  });
  const fitLabel = $derived(
    fit === "strong" ? "Strong fit" : fit === "partial" ? "Partial fit" : fit === "weak" ? "Weak fit" : "Unknown",
  );
  const heading = $derived([analysis.job.title, analysis.job.company].filter(Boolean).join(" · "));
  const verdictRest = $derived(
    total > 0 ? `${inLibrary} of ${total} JD skills are in your library` : "Couldn’t extract JD skills — check the pasted JD.",
  );

  function skillsPhrase(n: number, kind: "strong" | "partial" | "missing"): string {
    const skills = n === 1 ? "skill" : "skills";
    if (kind === "strong") return `${n} ${skills} matched strongly`;
    if (kind === "partial") return `${n} ${skills} matched partially`;
    return `${n} ${skills} missing`;
  }

  const matchAria = $derived(
    [
      strongN ? skillsPhrase(strongN, "strong") : "",
      partialN ? skillsPhrase(partialN, "partial") : "",
      missingN ? skillsPhrase(missingN, "missing") : "",
    ]
      .filter(Boolean)
      .join(", ") || "No JD skills extracted",
  );
</script>

<div class="hero" class:compact>
  <div class="hero-top">
    {#if heading}
      <p class="kicker">{heading}</p>
    {/if}
    <p class="verdict">
      <mark class="hl {fit}">{fitLabel}</mark><span> — {verdictRest}</span>
    </p>
  </div>

  {#if total > 0}
    <div class="stack-block">
      <div class="stack" role="img" aria-label={matchAria}>
        {#if strongN}
          <span class="seg strong" style:flex={strongN}></span>
        {/if}
        {#if partialN}
          <span class="seg partial" style:flex={partialN}></span>
        {/if}
        {#if missingN}
          <span class="seg missing" style:flex={missingN}></span>
        {/if}
      </div>
      <div class="stack-labels" aria-hidden="true">
        {#if strongN}
          <span class="stack-label strong" style:flex={strongN}>{skillsPhrase(strongN, "strong")}</span>
        {/if}
        {#if partialN}
          <span class="stack-label partial" style:flex={partialN}>{skillsPhrase(partialN, "partial")}</span>
        {/if}
        {#if missingN}
          <span class="stack-label missing" style:flex={missingN}>{skillsPhrase(missingN, "missing")}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .hero-top {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .kicker {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
  }
  .verdict {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.45;
  }
  mark.hl {
    font-style: normal;
    font-weight: 750;
    padding: 0.05em 0.32em;
    border-radius: 0.28em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  mark.hl.strong {
    background: #dcfce7;
    color: #166534;
  }
  mark.hl.partial {
    background: #fef3c7;
    color: #92400e;
  }
  mark.hl.weak {
    background: #fee2e2;
    color: #991b1b;
  }
  mark.hl.unknown {
    background: var(--color-bg, #f3f4f6);
    color: var(--color-muted);
  }
  .stack-block {
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
  }
  .stack {
    display: flex;
    height: 0.45rem;
    border-radius: 99px;
    overflow: hidden;
    background: var(--color-border);
  }
  .seg {
    min-width: 0;
  }
  .seg.strong {
    background: #16a34a;
  }
  .seg.partial {
    background: #d97706;
  }
  .seg.missing {
    background: #dc2626;
  }
  .stack-labels {
    display: flex;
    align-items: flex-start;
  }
  .stack-label {
    min-width: 0;
    padding-right: 0.45rem;
    font-size: 0.6875rem;
    font-weight: 650;
    line-height: 1.3;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .stack-label.strong {
    color: #166534;
  }
  .stack-label.partial {
    color: #92400e;
  }
  .stack-label.missing {
    color: #991b1b;
  }
  .stack-label:last-child {
    padding-right: 0;
  }
  .compact .verdict {
    font-size: 0.95rem;
  }
</style>
