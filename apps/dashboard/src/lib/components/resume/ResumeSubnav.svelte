<script lang="ts">
	import { page } from '$app/state';

	const path = $derived(page.url.pathname);

	const tabs = [
		{ href: '/resume/tailor', label: 'Tailor to a job', match: (p: string) => p.startsWith('/resume/tailor') },
		{ href: '/resume/analyses', label: 'JD history', match: (p: string) => p.startsWith('/resume/analyses') },
		{ href: '/resume', label: 'Your resumes', match: (p: string) => p === '/resume' },
		{ href: '/resume/new', label: 'New resume', match: (p: string) => p.startsWith('/resume/new') }
	];
</script>

<nav class="subnav" aria-label="Resume section">
	{#each tabs as tab (tab.href)}
		<a href={tab.href} class={['tab', tab.match(path) && 'on']}>{tab.label}</a>
	{/each}
</nav>

<style>
	.subnav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0 0 var(--space-4);
		padding: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		width: fit-content;
		max-width: 100%;
	}
	.tab {
		padding: 0.35rem 0.7rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-muted);
		text-decoration: none;
	}
	.tab:hover {
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-surface) 70%, transparent);
	}
	.tab.on {
		background: var(--color-surface);
		color: var(--color-primary);
		box-shadow: var(--shadow-xs);
		font-weight: 600;
	}
</style>
