<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Logo } from '@foliyo/ui';
	import { foliyoVersion, isSaas } from '$lib/config';

	type Props = {
		open?: boolean;
		collapsed?: boolean;
		onclose?: () => void;
		ontogglecollapse?: () => void;
	};

	let { open = false, collapsed = false, onclose, ontogglecollapse }: Props = $props();

	const STORAGE_GROUPS = 'foliyo.nav.groups';

	type NavIcon =
		| 'home'
		| 'user'
		| 'upload'
		| 'link'
		| 'spark'
		| 'folder'
		| 'briefcase'
		| 'grad'
		| 'award'
		| 'lang'
		| 'globe'
		| 'file'
		| 'target'
		| 'pen'
		| 'kanban'
		| 'settings';

	type NavItem = { href: string; label: string; icon: NavIcon; badge?: string };
	type NavGroup = { id: string; label: string; collapsible?: boolean; items: NavItem[] };

	let openGroups = $state<Record<string, boolean>>({
		library: true,
		publish: true
	});

	const groups = $derived(
		[
			{
				id: 'top',
				label: '',
				items: [{ href: '/', label: 'Overview', icon: 'home' }]
			},
			{
				id: 'library',
				label: 'My Library',
				collapsible: true,
				items: [
					{ href: '/basics', label: 'Basics', icon: 'user' },
					...(isSaas
						? [{ href: '/import', label: 'Import resume', icon: 'upload' as NavIcon, badge: 'AI' }]
						: [{ href: '/import', label: 'Import', icon: 'upload' as NavIcon }]),
					{ href: '/social', label: 'Social', icon: 'link' },
					{ href: '/skills', label: 'Skills', icon: 'spark' },
					{ href: '/projects', label: 'Projects', icon: 'folder' },
					{ href: '/experience', label: 'Experience', icon: 'briefcase' },
					{ href: '/education', label: 'Education', icon: 'grad' },
					{ href: '/certifications', label: 'Certifications', icon: 'award' },
					{ href: '/languages', label: 'Languages', icon: 'lang' }
				]
			},
			{
				id: 'publish',
				label: 'Publish',
				collapsible: true,
				items: [
					{ href: '/portfolios', label: 'Portfolios', icon: 'globe' },
					{ href: '/resume', label: 'Resumes', icon: 'file' },
					{ href: '/resume/tailor', label: 'Tailor to a job', icon: 'target' },
					{ href: '/blog', label: 'Blog', icon: 'pen' }
				]
			},
			{
				id: 'account',
				label: 'Account',
				items: [{ href: '/settings', label: 'Settings', icon: 'settings' }]
			}
		] as NavGroup[]
	);

	onMount(() => {
		try {
			const raw = localStorage.getItem(STORAGE_GROUPS);
			if (raw) {
				const parsed = JSON.parse(raw) as Record<string, boolean>;
				openGroups = { ...openGroups, ...parsed };
			}
		} catch {
			/* ignore */
		}
	});

	function persistGroups() {
		try {
			localStorage.setItem(STORAGE_GROUPS, JSON.stringify(openGroups));
		} catch {
			/* ignore */
		}
	}

	function toggleGroup(id: string) {
		openGroups = { ...openGroups, [id]: !openGroups[id] };
		persistGroups();
	}

	let lastPath = '';
	$effect(() => {
		const path = page.url.pathname;
		if (open && lastPath && path !== lastPath) {
			onclose?.();
		}
		lastPath = path;
	});

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		if (href === '/resume') {
			return pathname === '/resume' || pathname.startsWith('/resume/new');
		}
		if (href === '/resume/tailor') {
			return pathname.startsWith('/resume/tailor') || pathname.startsWith('/resume/analyses');
		}
		return pathname === href || pathname.startsWith(href + '/');
	}

	function close() {
		onclose?.();
	}

	function groupExpanded(group: NavGroup): boolean {
		if (!group.collapsible) return true;
		if (collapsed) return true;
		return openGroups[group.id] !== false;
	}
</script>

{#if open}
	<button type="button" class="backdrop" aria-label="Close menu" onclick={close}></button>
{/if}

<aside class="sidebar" class:open class:collapsed>
	<div class="brand">
		<a href="/" class="brand-link" title="Foliyo" onclick={close}>
			{#if collapsed}
				<span class="brand-mark" aria-hidden="true">F</span>
			{:else}
				<Logo height={28} />
			{/if}
		</a>
		<button type="button" class="close-btn" aria-label="Close menu" onclick={close}>✕</button>
		<button
			type="button"
			class="collapse-btn"
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			aria-pressed={collapsed}
			onclick={() => ontogglecollapse?.()}
		>
			{#if collapsed}
				<span aria-hidden="true">»</span>
			{:else}
				<span aria-hidden="true">«</span>
			{/if}
		</button>
	</div>
	<nav>
		{#each groups as group (group.id)}
			<div class="group">
				{#if group.label}
					{#if group.collapsible && !collapsed}
						<button
							type="button"
							class="group-label toggle"
							aria-expanded={groupExpanded(group)}
							onclick={() => toggleGroup(group.id)}
						>
							<span>{group.label}</span>
							<span class="chev" aria-hidden="true">{groupExpanded(group) ? '▾' : '▸'}</span>
						</button>
					{:else if !collapsed}
						<p class="group-label">{group.label}</p>
					{/if}
				{/if}
				{#if groupExpanded(group)}
					<ul>
						{#each group.items as item (item.href)}
							<li>
								<a
									href={item.href}
									class:active={isActive(item.href, page.url.pathname)}
									title={item.label}
									onclick={close}
								>
									<span class="nav-icon" aria-hidden="true" data-icon={item.icon}>
										{#if item.icon === 'home'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path d="M2.5 7.5 8 3l5.5 4.5V14a.5.5 0 0 1-.5.5H10v-4H6v4H3a.5.5 0 0 1-.5-.5V7.5z" /></svg
											>
										{:else if item.icon === 'user'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c1.2-2.2 3-3.2 5-3.2s3.8 1 5 3.2" /></svg
											>
										{:else if item.icon === 'upload'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path d="M8 10.5V3M5 5.5 8 2.5l3 3M3 13h10" /></svg
											>
										{:else if item.icon === 'link'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path
													d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.5.5M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 1 0 3.5 3.5l.5-.5"
												/></svg
											>
										{:else if item.icon === 'spark'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" /></svg
											>
										{:else if item.icon === 'folder'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path d="M2.5 4.5h4l1.5 1.5h5.5v7H2.5v-8.5z" /></svg
											>
										{:else if item.icon === 'briefcase'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><rect x="2" y="5" width="12" height="8.5" rx="1" /><path d="M6 5V3.5h4V5M2 8.5h12" /></svg
											>
										{:else if item.icon === 'grad'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path d="M1.5 7 8 4l6.5 3L8 10 1.5 7zM4 8.5v3L8 13.5l4-2v-3" /></svg
											>
										{:else if item.icon === 'award'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><circle cx="8" cy="6.5" r="3.5" /><path d="M6 9.5 5 14l3-1.5L11 14l-1-4.5" /></svg
											>
										{:else if item.icon === 'lang'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c1.5 1.8 2.2 3.5 2.2 5.5S9.5 11.7 8 13.5M8 2.5C6.5 4.3 5.8 6 5.8 8s.7 3.7 2.2 5.5" /></svg
											>
										{:else if item.icon === 'globe'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c1.8 2 2.5 3.8 2.5 5.5S9.8 12 8 13.5M8 2.5C6.2 4.5 5.5 6.3 5.5 8S6.2 12 8 13.5" /></svg
											>
										{:else if item.icon === 'file'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path d="M4.5 2.5h5l3 3V13.5h-8v-11zM9.5 2.5v3h3" /></svg
											>
										{:else if item.icon === 'target'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.5" /><path d="M8 2.5V4M8 12v1.5M2.5 8H4M12 8h1.5" /></svg
											>
										{:else if item.icon === 'pen'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><path d="M9.5 3.5 12.5 6.5 6 13H3v-3l6.5-6.5z" /></svg
											>
										{:else if item.icon === 'kanban'}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><rect x="2.5" y="2.5" width="3.5" height="11" rx="0.5" /><rect x="7" y="2.5" width="3.5" height="7" rx="0.5" /><rect x="11.5" y="2.5" width="2" height="9" rx="0.5" /></svg
											>
										{:else}
											<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
												><circle cx="8" cy="8" r="2" /><path
													d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M4.2 4.2l1 1M10.8 10.8l1 1M11.8 4.2l-1 1M5.2 10.8l-1 1"
												/></svg
											>
										{/if}
									</span>
									<span class="nav-label">{item.label}</span>
									{#if item.badge && !collapsed}
										<span class="nav-badge" class:ai={item.badge === 'AI'}>{item.badge}</span>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</nav>
	{#if !collapsed}
		<div class="footer">
			<p class="version" title="Foliyo version">Foliyo v{foliyoVersion}</p>
		</div>
	{/if}
</aside>

<style>
	.backdrop {
		display: none;
	}
	.sidebar {
		width: var(--sidebar-width, 220px);
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		z-index: 40;
		transition: width 0.15s ease;
	}
	.sidebar.collapsed {
		width: var(--sidebar-width-collapsed, 64px);
	}
	.brand {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: var(--header-height);
		padding: 0 var(--space-3);
		border-bottom: 1px solid var(--color-border);
		box-sizing: border-box;
		gap: var(--space-2);
	}
	.brand-link {
		display: flex;
		align-items: center;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius);
		background: var(--color-primary);
		color: #fff;
		font-weight: 700;
		font-size: 0.9375rem;
	}
	.close-btn,
	.collapse-btn {
		width: 1.875rem;
		height: 1.875rem;
		border: 0;
		border-radius: var(--radius);
		background: transparent;
		color: var(--color-muted);
		font-size: 0.875rem;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
	}
	.close-btn {
		display: none;
	}
	.close-btn:hover,
	.collapse-btn:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}
	.sidebar.collapsed .collapse-btn {
		margin-inline: auto;
	}
	.sidebar.collapsed .brand-link {
		display: none;
	}
	nav {
		padding: var(--space-2) 0;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}
	.group {
		margin-bottom: var(--space-2);
	}
	.group-label {
		margin: 0;
		padding: var(--space-2) var(--space-4) var(--space-1);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.group-label.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		border: 0;
		background: transparent;
		cursor: pointer;
		text-align: left;
		font: inherit;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
		padding: var(--space-2) var(--space-4) var(--space-1);
	}
	.group-label.toggle:hover {
		color: var(--color-text);
	}
	.chev {
		font-size: 0.625rem;
		opacity: 0.8;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0.4rem var(--space-4);
		color: var(--color-text);
		text-decoration: none;
		font-size: 0.8125rem;
		min-height: 2rem;
	}
	.sidebar.collapsed a {
		justify-content: center;
		padding: 0.45rem;
	}
	a:hover {
		background: var(--color-bg);
	}
	a.active {
		background: var(--color-primary-light);
		color: var(--color-primary);
		font-weight: 600;
	}
	.nav-icon {
		display: inline-flex;
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		opacity: 0.85;
	}
	.nav-icon :global(svg) {
		width: 100%;
		height: 100%;
	}
	a.active .nav-icon {
		opacity: 1;
	}
	.nav-label {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sidebar.collapsed .nav-label,
	.sidebar.collapsed .nav-badge {
		display: none;
	}
	.nav-badge {
		flex-shrink: 0;
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.12rem 0.35rem;
		border-radius: var(--radius-sm);
		line-height: 1.2;
		background: var(--color-bg);
		color: var(--color-muted);
	}
	.nav-badge.ai {
		background: var(--color-primary);
		color: #fff;
	}
	.footer {
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-border);
	}
	.version {
		margin: 0;
		font-size: 0.6875rem;
		color: var(--color-muted);
		letter-spacing: 0.02em;
	}

	@media (max-width: 900px) {
		.backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 35;
			border: 0;
			padding: 0;
			margin: 0;
			background: rgba(15, 23, 42, 0.4);
			cursor: pointer;
		}
		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			width: min(var(--sidebar-width, 220px), 86vw);
			transform: translateX(-105%);
			transition: transform 0.2s ease, visibility 0.2s;
			box-shadow: none;
			border-right: 1px solid var(--color-border);
			visibility: hidden;
			pointer-events: none;
		}
		.sidebar.collapsed {
			width: min(var(--sidebar-width, 220px), 86vw);
		}
		.sidebar.open {
			transform: translateX(0);
			box-shadow: 8px 0 32px rgba(15, 23, 42, 0.18);
			visibility: visible;
			pointer-events: auto;
		}
		.sidebar.collapsed .brand-link {
			display: flex;
		}
		.sidebar.collapsed .nav-label {
			display: block;
		}
		.collapse-btn {
			display: none;
		}
		.close-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
