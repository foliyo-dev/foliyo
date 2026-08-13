<script lang="ts">
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import PlanExpiryBanner from '$lib/components/PlanExpiryBanner.svelte';

  let navOpen = false;
</script>

<div class="app-shell" class:nav-open={navOpen}>
  <Sidebar open={navOpen} on:close={() => (navOpen = false)} />
  <div class="main">
    <Header on:menu={() => (navOpen = true)}>
      <span></span>
    </Header>
    <div class="content">
      <PlanExpiryBanner />
      <slot />
    </div>
  </div>
</div>

<style>
  .app-shell {
    display: flex;
    height: 100dvh;
    overflow: hidden;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .content {
    padding: 1.5rem;
    flex: 1;
    min-height: 0;
    overflow: auto;
    overflow-x: clip;
    container-type: size;
    container-name: app-content;
  }

  @media (max-width: 900px) {
    .content {
      padding: 1rem 0.85rem 1.25rem;
    }
  }
</style>
