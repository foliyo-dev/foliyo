<script lang="ts">
  import { page } from '$app/state';
  import { Logo } from '@foliyo/ui';
  import { logout } from '$lib/stores/auth';
  import { isSaas } from '$lib/config';

  type NavItem = { href: string; label: string };
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
        ...(isSaas ? [{ href: '/import', label: 'Import resume' }] : []),
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

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }
</script>

<aside class="sidebar">
  <div class="brand">
    <Logo height={32} />
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
              <a href={item.href} class:active={isActive(item.href, page.url.pathname)}>
                {item.label}
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
  .sidebar {
    width: 240px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .brand {
    display: flex;
    align-items: center;
    height: 3.75rem;
    /* Nudge left so the tile mark lines up with nav text (SVG has inset padding) */
    padding: 0 1.5rem 0 calc(1.5rem - 0.175rem);
    border-bottom: 1px solid var(--color-border);
    box-sizing: border-box;
  }
  nav {
    padding: 0.75rem 0;
    flex: 1;
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
    display: block;
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
  .footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
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
</style>
