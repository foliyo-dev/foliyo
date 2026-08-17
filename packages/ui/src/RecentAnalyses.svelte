<script lang="ts">
  import type { JobAnalysisSummary } from "@foliyo/jobs-client";

  let {
    items,
    activeId = null,
    matchedId = null,
    onSelect,
    showIntro = true,
  }: {
    items: JobAnalysisSummary[];
    activeId?: string | null;
    matchedId?: string | null;
    onSelect: (id: string) => void;
    showIntro?: boolean;
  } = $props();

  function heading(item: JobAnalysisSummary): string {
    return [item.title, item.company].filter(Boolean).join(" · ") || "Untitled JD";
  }

  function fitLabel(fit: JobAnalysisSummary["fit"]): string {
    if (fit === "strong") return "Strong";
    if (fit === "partial") return "Partial";
    if (fit === "weak") return "Weak";
    return "Unknown";
  }

  function relativeTime(iso: string): string {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const mins = Math.round((Date.now() - t) / 60_000);
    if (Math.abs(mins) < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 14) return `${days}d ago`;
    return new Date(t).toLocaleDateString();
  }
</script>

{#if items.length}
  <section class="recents">
    {#if showIntro}
      <h3>Saved analyses</h3>
      <p class="hint">Open one to continue — that does not use your daily AI units.</p>
    {/if}
    <ul>
      {#each items as item (item.id)}
        <li>
          <button
            type="button"
            class={["row", item.id === activeId && "active", item.id === matchedId && "match"]}
            onclick={() => onSelect(item.id)}
          >
            <span class="title">{heading(item)}</span>
            <span class="meta">
              <span class={["fit", item.fit]}>{fitLabel(item.fit)}</span>
              <span>{item.coverage.required_in_library} of {item.coverage.required_total} in library</span>
              <span>{relativeTime(item.updated_at || item.created_at)}</span>
            </span>
            {#if item.id === matchedId && item.id !== activeId}
              <span class="reuse">This JD · no extra unit</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .recents {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  h3 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-muted);
  }
  .hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-muted);
    line-height: 1.35;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .row {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    text-align: left;
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .row:hover {
    border-color: var(--color-primary-muted, #93c5fd);
  }
  .row.active {
    border-color: var(--color-primary, #2563eb);
    box-shadow: 0 0 0 1px var(--color-primary, #2563eb);
  }
  .row.match:not(.active) {
    border-style: dashed;
  }
  .title {
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    font-size: 0.6875rem;
    color: var(--color-muted);
  }
  .fit {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .fit.strong {
    color: #166534;
  }
  .fit.partial {
    color: #92400e;
  }
  .fit.weak {
    color: #991b1b;
  }
  .reuse {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-primary, #2563eb);
  }
</style>
