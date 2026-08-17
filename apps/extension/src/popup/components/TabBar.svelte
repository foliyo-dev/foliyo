<script lang="ts">
  export let tab: "analyze" | "history" | "resumes" | "create";
  export let onTab: (t: "analyze" | "history" | "resumes" | "create") => void;
</script>

<nav class="tab-bar" aria-label="Extension navigation">
  <button type="button" class="tab-btn" class:on={tab === "analyze"} on:click={() => onTab("analyze")}>
    Tailor
  </button>
  <button type="button" class="tab-btn" class:on={tab === "history"} on:click={() => onTab("history")}>
    History
  </button>
  <button type="button" class="tab-btn" class:on={tab === "resumes"} on:click={() => onTab("resumes")}>
    Resumes
  </button>
  <button type="button" class="tab-btn" class:on={tab === "create"} on:click={() => onTab("create")}>
    Create
  </button>
</nav>
