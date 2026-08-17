<script lang="ts">
  import type { JobAnalysis, ProposedChange, SkillMatch } from "@foliyo/jobs-client";
  import { popupBands } from "@foliyo/jobs-client";
  import CoverageHero from "./CoverageHero.svelte";

  let {
    analysis,
    accepted = $bindable(new Set<string>()),
    compact = false,
    skillsBaseUrl = null,
  }: {
    analysis: JobAnalysis;
    accepted: Set<string>;
    compact?: boolean;
    skillsBaseUrl?: string | null;
  } = $props();

  const bands = $derived(popupBands(analysis.matches));
  const adds = $derived(analysis.proposed_changes.filter((c) => c.action !== "deemphasize_skill"));
  const drops = $derived(analysis.proposed_changes.filter((c) => c.action === "deemphasize_skill"));

  function setAccepted(id: string, on: boolean) {
    const next = new Set(accepted);
    if (on) next.add(id);
    else next.delete(id);
    accepted = next;
  }

  function kindLabel(c: ProposedChange): string {
    if (c.action === "add_skill") return "Skill";
    if (c.action === "add_project") return "Project";
    if (c.action === "add_experience") return "Experience";
    return "Skill";
  }

  function libraryPath(path: string): string | null {
    if (!skillsBaseUrl) return null;
    return `${skillsBaseUrl.replace(/\/$/, "")}${path}`;
  }

  function skillLink(name: string): string | null {
    const base = libraryPath("/skills");
    if (!base) return null;
    return `${base}?q=${encodeURIComponent(name)}`;
  }

  function matchKey(m: SkillMatch): string {
    return m.skill_id ?? m.requirement.normalized;
  }

  /** Collapse duplicate evidence labels (same project tagged three ways → Pressbin ×3). */
  function evidenceTags(m: SkillMatch): { label: string; count: number }[] {
    const map = new Map<string, number>();
    for (const e of m.evidence) {
      const label = e.label.trim() || "Library";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, count]) => ({ label, count }));
  }
</script>

<div class="panel" class:compact>
  {#if !compact}
    <CoverageHero {analysis} />
  {/if}

  {#if bands.strong.length}
    <section>
      <h3>Strong</h3>
      <ul class="chips">
        {#each bands.strong as m (matchKey(m))}
          <li class="chip strong">
            <span class="name">{m.requirement.name}</span>
            {#each evidenceTags(m) as tag (`${matchKey(m)}-${tag.label}`)}
              <span class="tag">{tag.label}{#if tag.count > 1} ×{tag.count}{/if}</span>
            {/each}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if bands.partial.length}
    <section>
      <h3>Partial</h3>
      <p class="hint">In Skills, but no job or project is tagged with them yet.</p>
      <ul class="chips">
        {#each bands.partial as m (matchKey(m))}
          <li class="chip partial">
            <span class="name">{m.requirement.name}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if bands.missing.length}
    <section class="missing">
      <h3>Missing from library</h3>
      <ul class="chips">
        {#each bands.missing as m (matchKey(m))}
          {@const href = skillLink(m.requirement.name)}
          <li class="chip missing">
            {#if href}
              <a class="name link" {href} target="_blank" rel="noreferrer">
                {m.requirement.name}
              </a>
            {:else}
              <span class="name">{m.requirement.name}</span>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="nudge">
        No jobs or projects in your library use these. If you have them, add the skill and tag that
        work, then analyze again — the fit score will improve.
        {#if libraryPath("/skills")}
          {@const skillsHref = libraryPath("/skills")}
          <a class="link-inline" href={skillsHref} target="_blank" rel="noreferrer">Open Skills</a>
        {/if}
      </p>
    </section>
  {/if}

  {#if adds.length || drops.length}
    <section class="review">
      <h3>This tailored resume</h3>
      {#if adds.length}
        <p class="subhead">Include from your library</p>
        <p class="hint">Already in Foliyo. Skip anything you don’t want on this version.</p>
        <ul class="choices">
          {#each adds as c (c.id)}
            {@const on = accepted.has(c.id)}
            <li class="choice" class:on>
              <div class="choice-body">
                <span class="kind">{kindLabel(c)}</span>
                <strong>{c.label}</strong>
              </div>
              <div class="seg" role="group" aria-label="Include {c.label} on this resume">
                <button
                  type="button"
                  class={["seg-btn", on && "active"]}
                  aria-pressed={on}
                  onclick={() => setAccepted(c.id, true)}
                >
                  Include
                </button>
                <button
                  type="button"
                  class={["seg-btn", !on && "active"]}
                  aria-pressed={!on}
                  onclick={() => setAccepted(c.id, false)}
                >
                  Skip
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
      {#if drops.length}
        <details class="drops-fold">
          <summary>
            Not in this job
            <span class="count">{drops.length}</span>
          </summary>
          <p class="hint">
            On the current resume, but this JD doesn’t ask for them. Left off unless you keep them.
          </p>
          <ul class="choices">
            {#each drops as c (c.id)}
              {@const leavingOff = accepted.has(c.id)}
              <li class="choice drop" class:on={!leavingOff}>
                <div class="choice-body">
                  <span class="kind">Not in JD</span>
                  <strong>{c.label}</strong>
                </div>
                {#if leavingOff}
                  <button type="button" class="text-btn" onclick={() => setAccepted(c.id, false)}>
                    Keep anyway
                  </button>
                {:else}
                  <button type="button" class="text-btn" onclick={() => setAccepted(c.id, true)}>
                    Leave off
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        </details>
      {/if}
    </section>
  {/if}
</div>

<style>
  .panel {
    margin-top: 0.85rem;
    padding: 1rem 1.05rem 1.1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    gap: 0.95rem;
  }
  h3 {
    margin: 0 0 0.4rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-muted);
  }
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.3rem;
    padding: 0.28rem 0.55rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    border: 1px solid transparent;
  }
  .chip.strong {
    background: #dcfce7;
    color: #166534;
  }
  .chip.partial {
    background: #fef3c7;
    color: #92400e;
  }
  .chip.missing {
    background: #fee2e2;
    color: #991b1b;
  }
  .name {
    font-weight: 650;
  }
  .link {
    color: inherit;
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  .tag {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in srgb, #166534 12%, white);
    color: #14532d;
  }
  .hint {
    margin: 0 0 0.45rem;
    color: var(--color-muted);
    font-size: 0.75rem;
    font-weight: 400;
  }
  .nudge {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: var(--color-muted);
    line-height: 1.45;
  }
  .link-inline {
    margin-left: 0.25rem;
    font-weight: 650;
    color: var(--color-primary);
    text-decoration: none;
  }
  .link-inline:hover {
    text-decoration: underline;
  }
  .missing h3 {
    color: #b45309;
  }
  .review {
    padding-top: 0.65rem;
    border-top: 1px solid var(--color-border);
  }
  .subhead {
    margin: 0.65rem 0 0.2rem;
    font-size: 0.8125rem;
    font-weight: 650;
  }
  .drops-fold {
    margin-top: 0.65rem;
  }
  .drops-fold summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8125rem;
    font-weight: 650;
    color: var(--color-muted);
  }
  .drops-fold summary::-webkit-details-marker,
  .drops-fold summary::marker {
    display: none;
    content: "";
  }
  .drops-fold summary::before {
    content: "";
    width: 0.4rem;
    height: 0.4rem;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.12s ease;
  }
  .drops-fold[open] summary {
    margin-bottom: 0.2rem;
    color: inherit;
  }
  .drops-fold[open] summary::before {
    transform: rotate(45deg);
  }
  .drops-fold .count {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: var(--color-border);
    color: var(--color-muted);
  }
  .choices {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .choice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
  }
  .choice.on {
    border-color: color-mix(in srgb, #16a34a 35%, var(--color-border));
    background: color-mix(in srgb, #dcfce7 45%, var(--color-bg));
  }
  .choice.drop.on {
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
    background: color-mix(in srgb, var(--color-primary-light, #eeedfe) 55%, var(--color-bg));
  }
  .choice-body {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .choice-body strong {
    font-size: 0.875rem;
  }
  .kind {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-muted);
  }
  .seg {
    display: inline-flex;
    flex-shrink: 0;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }
  .seg-btn {
    font: inherit;
    font-size: 0.75rem;
    font-weight: 650;
    padding: 0.28rem 0.65rem;
    border: 0;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
  }
  .seg-btn.active {
    background: #166534;
    color: #fff;
  }
  .seg-btn:last-child.active {
    background: var(--color-bg);
    color: var(--color-muted);
    box-shadow: inset 0 0 0 1px var(--color-border);
  }
  .text-btn {
    flex-shrink: 0;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 650;
    padding: 0.28rem 0.65rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-bg);
    color: var(--color-text, inherit);
    cursor: pointer;
  }
  .text-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .compact {
    padding: 0.75rem 0.85rem;
    gap: 0.75rem;
  }
</style>
