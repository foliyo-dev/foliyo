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
		gap: 0.35rem;
		margin: -0.5rem 0 1.25rem;
		padding: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		width: fit-content;
		max-width: 100%;
	}
	.tab {
		padding: 0.5rem 0.85rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-muted);
		text-decoration: none;
	}
	.tab:hover {
		color: var(--color-text);
	}
	.tab.on {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 1px 2px rgba(26, 26, 46, 0.06);
		font-weight: 600;
	}
</style>
