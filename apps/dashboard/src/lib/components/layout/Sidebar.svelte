<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { page } from '$app/state';
  import { Logo } from '@foliyo/ui';
  import { logout } from '$lib/stores/auth';
  import { isSaas } from '$lib/config';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  type NavItem = { href: string; label: string; badge?: string };
  type NavGroup = { label: string; items: NavItem[] };

  /** Visible for all hosted users; free hit /import → upgrade (no upload). */
  $: groups = [
    {
      label: '',
      items: [{ href: '/', label: 'Overview' }]
    },
    {
      label: 'My content',
      items: [
        { href: '/basics', label: 'Basics' },
        ...(isSaas ? [{ href: '/import', label: 'AI resume', badge: 'AI' }] : []),
        { href: '/social', label: 'Social' },
        { href: '/skills', label: 'Skills' },
        { href: '/projects', label: 'Projects' },
        { href: '/experience', label: 'Experience' },
        { href: '/education', label: 'Education' },
        { href: '/certifications', label: 'Certifications' },
        { href: '/languages', label: 'Languages' }
      ]
    },
    {
      label: 'Publish',
      items: [
        { href: '/portfolios', label: 'Portfolios' },
        { href: '/resume', label: 'Resume' },
        { href: '/applications', label: 'Applications' }
      ]
    },
    {
      label: 'Account',
      items: [{ href: '/settings', label: 'Settings' }]
    }
  ] as NavGroup[];

  // Close drawer after navigating on mobile
  let lastPath = '';
  $: {
    const path = page.url.pathname;
    if (open && lastPath && path !== lastPath) {
      dispatch('close');
    }
    lastPath = path;
  }

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function close() {
    dispatch('close');
  }

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }
</script>

{#if open}
  <button type="button" class="backdrop" aria-label="Close menu" on:click={close}></button>
{/if}

<aside class="sidebar" class:open>
  <div class="brand">
    <Logo height={32} />
    <button type="button" class="close-btn" aria-label="Close menu" on:click={close}>
      ✕
    </button>
  </div>
  <nav>
    {#each groups as group}
      <div class="group">
        {#if group.label}
          <p class="group-label">{group.label}</p>
        {/if}
        <ul>
          {#each group.items as item}
            <li>
              <a href={item.href} class:active={isActive(item.href, page.url.pathname)} on:click={close}>
                <span class="nav-label">{item.label}</span>
                {#if item.badge}
                  <span class="nav-badge" class:ai={item.badge === 'AI'}>{item.badge}</span>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
  <div class="footer">
    <button type="button" class="logout" on:click={handleLogout}>Log out</button>
  </div>
</aside>

<style>
  .backdrop {
    display: none;
  }
  .sidebar {
    width: var(--sidebar-width, 240px);
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    z-index: 40;
  }
  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 3.75rem;
    /* Nudge left so the tile mark lines up with nav text (SVG has inset padding) */
    padding: 0 1rem 0 calc(1.5rem - 0.175rem);
    border-bottom: 1px solid var(--color-border);
    box-sizing: border-box;
  }
  .close-btn {
    display: none;
    width: 2.25rem;
    height: 2.25rem;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: var(--color-muted);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
  }
  .close-btn:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }
  nav {
    padding: 0.75rem 0;
    flex: 1;
    overflow-y: auto;
  }
  .group {
    margin-bottom: 0.75rem;
  }
  .group-label {
    margin: 0;
    padding: 0.5rem 1.5rem 0.35rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 1.5rem;
    color: var(--color-text);
    text-decoration: none;
    font-size: 0.875rem;
  }
  a:hover {
    background: var(--color-bg);
  }
  a.active {
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: 600;
  }
  .nav-label {
    min-width: 0;
  }
  .nav-badge {
    flex-shrink: 0;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    line-height: 1.2;
    background: var(--color-bg);
    color: var(--color-muted);
  }
  .nav-badge.ai {
    background: var(--color-primary);
    color: #fff;
  }
  a.active .nav-badge.ai {
    background: var(--color-primary);
    color: #fff;
  }
  .footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.65rem;
  }
  .logout {
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0;
  }
  .logout:hover {
    color: var(--color-text);
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
      width: min(var(--sidebar-width, 240px), 86vw);
      transform: translateX(-105%);
      transition: transform 0.2s ease, visibility 0.2s;
      box-shadow: none;
      border-right: 1px solid var(--color-border);
      visibility: hidden;
      pointer-events: none;
    }
    .sidebar.open {
      transform: translateX(0);
      box-shadow: 8px 0 32px rgba(15, 23, 42, 0.18);
      visibility: visible;
      pointer-events: auto;
    }
    .close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .footer {
      display: none; /* logout lives in header on mobile */
    }
  }
</style>
