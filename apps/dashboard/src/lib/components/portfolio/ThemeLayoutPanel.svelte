<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import {
		generateThemeConfig,
		type ThemeConfig,
		type ThemeRecipe
	} from '$lib/api/ai';
	import {
		parseApiError,
		portfolioLayouts,
		portfolioThemes
	} from '$lib/api/portfolios';
	import { hasProFeatures } from '$lib/api/plan';
	import { isSaas } from '$lib/config';
	import { user } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';
	import { aiByok, aiConfigured, ensureAiUsage } from '$lib/stores/ai';
	import { onMount } from 'svelte';

	let {
		themeSlug = $bindable('minimal'),
		themeConfig = $bindable(null as ThemeConfig | null),
		portfolioId = undefined as string | undefined,
		onThemeConfigChange = ((_cfg: ThemeConfig | null) => {}) as (
			cfg: ThemeConfig | null
		) => void
	} = $props();

	let aiPrompt = $state('');
	let aiBusy = $state(false);
	let aiDraft = $state<ThemeConfig | null>(null);
	let advancedOpen = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');
	let jsonTouched = $state(false);

	onMount(() => {
		void ensureAiUsage();
	});

	const layout = $derived<ThemeRecipe>(themeConfig?.recipe ?? 'classic');
	const galleryMode = $derived(themeConfig?.chrome?.sections_mode === 'gallery');
	const isPro = $derived(hasProFeatures($user?.plan, isSaas));
	const canAiTheme = $derived(isPro && $aiConfigured);

	$effect(() => {
		if (!jsonTouched) {
			jsonText = themeConfig ? JSON.stringify(themeConfig, null, 2) : '';
		}
	});

	function setGalleryMode(enabled: boolean) {
		jsonTouched = false;
		if (enabled) {
			if (!themeConfig) {
				const nextConfig: ThemeConfig = {
					version: 1,
					recipe: 'classic',
					skin: { theme_slug: themeSlug },
					content: {},
					chrome: { sections_mode: 'gallery' }
				};
				themeConfig = nextConfig;
				onThemeConfigChange(nextConfig);
				return;
			}
			const nextConfig: ThemeConfig = {
				...themeConfig,
				chrome: { ...(themeConfig.chrome ?? {}), sections_mode: 'gallery' }
			};
			themeConfig = nextConfig;
			onThemeConfigChange(nextConfig);
			return;
		}
		if (!themeConfig) return;
		const nextConfig: ThemeConfig = {
			...themeConfig,
			chrome: { ...(themeConfig.chrome ?? {}), sections_mode: 'full' }
		};
		themeConfig = nextConfig;
		onThemeConfigChange(nextConfig);
	}

	function onGalleryModeChange(event: Event) {
		setGalleryMode((event.currentTarget as HTMLInputElement).checked);
	}

	function setLayout(next: ThemeRecipe) {
		jsonTouched = false;
		if (next === 'classic') {
			const sectionsMode = themeConfig?.chrome?.sections_mode;
			if (sectionsMode === 'gallery') {
				const nextConfig: ThemeConfig = {
					version: 1,
					recipe: 'classic',
					skin: { theme_slug: themeSlug },
					content: themeConfig?.content ?? {},
					chrome: { sections_mode: 'gallery' }
				};
				themeConfig = nextConfig;
				onThemeConfigChange(nextConfig);
				return;
			}
			themeConfig = null;
			onThemeConfigChange(null);
			return;
		}
		const sectionsMode = themeConfig?.chrome?.sections_mode;
		const nextConfig: ThemeConfig = {
			version: 1,
			recipe: next,
			skin:
				next === 'glassmorphic'
					? {
							colors: {
								bg: '#0B1224',
								ink: '#F8FAFC',
								muted: '#B6C2D9',
								accent: '#38BDF8',
								accentSoft: '#818CF8'
							},
							fonts: { heading: 'Sora', body: 'DM Sans' },
							glass: { blur: 'lg', opacity: 'medium', borderGlow: true }
						}
					: next === 'photo-hero'
						? {
								colors: {
									bg: '#0A0E17',
									ink: '#F8FAFC',
									muted: '#94A3B8',
									accent: '#3B82F6'
								},
								fonts: { heading: 'Space Grotesk', body: 'Outfit' }
							}
						: {
								colors: {
									bg: '#F5F2E9',
									ink: '#1C1A17',
									muted: '#6B6358',
									accent: '#C45C26'
								},
								fonts: { heading: 'Cormorant Garamond', body: 'Outfit' }
							},
			content: themeConfig?.content ?? {},
			chrome: {
				...(next === 'glassmorphic' ? { nav_style: 'floating-glass' } : {}),
				...(typeof sectionsMode === 'string' ? { sections_mode: sectionsMode } : {})
			}
		};
		themeConfig = nextConfig;
		onThemeConfigChange(nextConfig);
	}

	async function askAi() {
		if (!aiPrompt.trim() || aiBusy) return;
		if (!isPro) {
			showToast('AI themes are a Pro feature', 'error');
			return;
		}
		if (!$aiConfigured) {
			showToast(
				isSaas
					? 'AI is not configured on this server'
					: 'Set OPENROUTER_API_KEY on the server to enable AI themes (BYOK)',
				'error'
			);
			return;
		}
		aiBusy = true;
		aiDraft = null;
		try {
			const result = await generateThemeConfig({
				prompt: aiPrompt.trim(),
				portfolio_id: portfolioId,
				preferred_recipe: layout !== 'classic' ? layout : undefined
			});
			aiDraft = result.theme_config;
			showToast('Theme draft ready — review and apply', 'success');
		} catch (err) {
			const parsed = parseApiError(err);
			showToast(parsed.message, 'error');
		} finally {
			aiBusy = false;
		}
	}

	function applyDraft() {
		if (!aiDraft) return;
		jsonTouched = false;
		themeConfig = aiDraft;
		if (aiDraft.recipe === 'classic') {
			const slug = (aiDraft.skin as { theme_slug?: string } | undefined)?.theme_slug;
			if (slug && (portfolioThemes as readonly string[]).includes(slug)) {
				themeSlug = slug;
			}
		}
		onThemeConfigChange(aiDraft);
		aiDraft = null;
		showToast('Theme applied to editor — save to publish', 'success');
	}

	function applyJson() {
		jsonError = '';
		try {
			const parsed = JSON.parse(jsonText) as ThemeConfig;
			if (!parsed || parsed.version !== 1 || !parsed.recipe) {
				jsonError = 'Must be ThemeConfig v1 with a recipe.';
				return;
			}
			jsonTouched = false;
			themeConfig = parsed;
			onThemeConfigChange(parsed);
			showToast('JSON theme applied', 'success');
		} catch {
			jsonError = 'Invalid JSON.';
		}
	}

	function clearThemeConfig() {
		jsonTouched = false;
		themeConfig = null;
		onThemeConfigChange(null);
	}

	function onLayoutChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value as ThemeRecipe;
		setLayout(value);
	}
</script>

<div class="theme-panel">
	<label class="field">
		<span class="label">Layout</span>
		<select value={layout} onchange={onLayoutChange}>
			{#each portfolioLayouts as l (l.id)}
				<option value={l.id}>{l.label} — {l.hint}</option>
			{/each}
		</select>
	</label>

	<label class="field check-field">
		<span class="label">
			<input type="checkbox" checked={galleryMode} onchange={onGalleryModeChange} />
			Show as photo gallery
		</span>
	</label>
	<p class="hint">
		Hides skills, experience, education, and resume download on the public folio.
	</p>

	{#if layout === 'classic'}
		<label class="field">
			<span class="label">Theme skin</span>
			<select bind:value={themeSlug}>
				{#each portfolioThemes as t (t)}
					<option value={t}>{t}</option>
				{/each}
			</select>
		</label>
	{:else}
		<p class="hint">
			Exotic layout <strong>{layout}</strong> uses ThemeConfig tokens.
			<button type="button" class="linkish" onclick={clearThemeConfig}>Reset to classic</button>
		</p>
	{/if}

	<details class="ai-block" open>
		<summary>Ask AI for a theme</summary>
		<p class="hint">
			Describe the look (e.g. “dark glassmorphic for a product designer” or “cream minimal gallery”).
			{#if $aiByok}
				Uses your OpenRouter key (BYOK).
			{:else}
				Costs AI units; Pro only.
			{/if}
		</p>
		<Textarea
			label="Prompt"
			bind:value={aiPrompt}
			rows={3}
			placeholder="Make it glassmorphic with blue accents and a bold hero…"
		/>
		<div class="row">
			<Button
				variant="secondary"
				disabled={aiBusy || !aiPrompt.trim() || !canAiTheme}
				on:click={askAi}
			>
				{aiBusy ? 'Generating…' : 'Generate theme'}
			</Button>
			{#if isSaas && !isPro}
				<a class="summary-link" href="/settings">Upgrade to Pro</a>
			{:else if !isSaas && !$aiConfigured}
				<span class="hint">Set OPENROUTER_API_KEY for AI</span>
			{/if}
		</div>
		{#if aiDraft}
			<div class="draft">
				<p class="draft-meta">
					Draft: <strong>{aiDraft.recipe}</strong>
				</p>
				<pre class="draft-json">{JSON.stringify(aiDraft, null, 2)}</pre>
				<Button on:click={applyDraft}>Apply draft to editor</Button>
			</div>
		{/if}
	</details>

	<details class="ai-block" bind:open={advancedOpen}>
		<summary>Advanced — ThemeConfig JSON</summary>
		<textarea
			class="json"
			bind:value={jsonText}
			rows={12}
			spellcheck="false"
			oninput={() => (jsonTouched = true)}
		></textarea>
		{#if jsonError}<p class="error">{jsonError}</p>{/if}
		<Button variant="secondary" size="sm" on:click={applyJson}>Apply JSON</Button>
	</details>
</div>

<style>
	.theme-panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.check-field .label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-weight: 600;
	}
	.check-field input {
		margin: 0;
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	select,
	.json {
		font: inherit;
		padding: 0.5rem 0.65rem;
		border-radius: 0.5rem;
		border: 1px solid var(--line, #e7e5e4);
		background: var(--surface, #fff);
		color: inherit;
	}
	.json {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		width: 100%;
		resize: vertical;
	}
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted, #78716c);
	}
	.linkish {
		background: none;
		border: 0;
		padding: 0;
		color: var(--accent, #0f766e);
		cursor: pointer;
		font: inherit;
		text-decoration: underline;
	}
	.ai-block {
		border: 1px solid var(--line, #e7e5e4);
		border-radius: 0.65rem;
		padding: 0.75rem 0.85rem;
	}
	.ai-block summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 0.875rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.5rem;
	}
	.summary-link {
		font-size: 0.8125rem;
		color: var(--accent, #0f766e);
	}
	.draft {
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.draft-meta {
		margin: 0;
		font-size: 0.8125rem;
	}
	.draft-json {
		margin: 0;
		max-height: 12rem;
		overflow: auto;
		font-size: 0.7rem;
		padding: 0.65rem;
		border-radius: 0.5rem;
		background: var(--bg-muted, #f5f5f4);
		border: 1px solid var(--line, #e7e5e4);
	}
	.error {
		color: #b91c1c;
		font-size: 0.8125rem;
		margin: 0.35rem 0 0;
	}
</style>
