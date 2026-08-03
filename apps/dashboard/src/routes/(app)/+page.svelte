<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import Card from '$lib/components/ui/Card.svelte';
</script>

<PageHeader
  title="Overview"
  description="Build once in your content library, then publish a public profile and resume."
/>

<div class="grid">
  <Card>
    <h2>My content</h2>
    <p>Basics, skills, projects, experience, education, certifications, and languages — your shared library.</p>
    <a href="/basics">Edit basics →</a>
  </Card>
  <Card>
    <h2>Portfolios</h2>
    <p>Curate one or more public views from your library — Free includes 1, Pro unlimited.</p>
    <a href="/portfolios">Manage portfolios →</a>
  </Card>
  <Card>
    <h2>Resume</h2>
    <p>Reuse the same library, pick a resume theme, and export PDF.</p>
    <a href="/resume">Open resume →</a>
  </Card>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }
  h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: var(--color-primary);
    font-weight: 600;
  }
  p {
    margin: 0 0 0.75rem;
    color: var(--color-muted);
    font-size: 0.875rem;
  }
  a {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-primary);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
</style>
