<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/portfolios', { replaceState: true });
  });
</script>

<p class="muted">Theme picks live on each portfolio…</p>

<style>
  .muted {
    color: var(--color-muted);
  }
</style>
