<script lang="ts">
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';
</script>

<div class="app-shell">
  <Sidebar />
  <div class="main">
    <Header>
      <span></span>
    </Header>
    <div class="content">
      <slot />
    </div>
  </div>
</div>

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .content {
    padding: 1.5rem;
    flex: 1;
  }
</style>
