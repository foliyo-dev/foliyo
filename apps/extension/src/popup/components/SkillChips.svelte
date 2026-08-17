<script lang="ts">
  export let skills: Array<{ id: string; name: string; level: string }> = [];
  export let selected: Set<string>;
  export let onChange: (ids: Set<string>) => void;

  let filter = "";

  $: visible = filter.trim()
    ? skills.filter((s) => `${s.name} ${s.level}`.toLowerCase().includes(filter.trim().toLowerCase()))
    : skills;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function selectFiltered() {
    const next = new Set(selected);
    for (const s of visible) next.add(s.id);
    onChange(next);
  }

  function clearAll() {
    onChange(new Set());
  }
</script>

<div class="skills-tools">
  <span class="label">{selected.size} selected</span>
  <div class="skills-tools-actions">
    <button type="button" class="linkish" on:click={selectFiltered}>
      {filter.trim() ? "Select filtered" : "Select all"}
    </button>
    <button type="button" class="linkish" on:click={clearAll}>Clear</button>
  </div>
</div>

<label class="field">
  <span class="sr-only">Filter skills</span>
  <input type="search" placeholder="Filter skills…" bind:value={filter} />
</label>

{#if skills.length === 0}
  <p class="muted">No confirmed skills yet — add some in Foliyo.</p>
{:else if visible.length === 0}
  <p class="muted">No skills match.</p>
{:else}
  <ul class="chips">
    {#each visible as sk (sk.id)}
      <li>
        <label class="chip" class:on={selected.has(sk.id)}>
          <input type="checkbox" checked={selected.has(sk.id)} on:change={() => toggle(sk.id)} />
          <span class="chip-text">
            {sk.name}
            <span class="meta">{sk.level}</span>
          </span>
        </label>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
