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
	import { ApiError } from '$lib/api/client';
	import { hasProFeatures } from '$lib/api/plan';
	import { uploadProjectImage } from '$lib/api/projects';
	import { isSaas, mediaUrl } from '$lib/config';
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

	let heroUploading = $state(false);
	let heroImageInput: HTMLInputElement | null = $state(null);
	let pasteHeroUrl = $state(false);
	let heroDragging = $state(false);
	let heroDragDepth = $state(0);

	onMount(() => {
		void ensureAiUsage();
	});

	const layout = $derived<ThemeRecipe>(themeConfig?.recipe ?? 'classic');
	const galleryMode = $derived(themeConfig?.chrome?.sections_mode === 'gallery');
	const isPro = $derived(hasProFeatures($user?.plan, isSaas));
	const canAiTheme = $derived(isPro && $aiConfigured);
	const showHeroPhoto = $derived(layout === 'photo-hero' || layout === 'glassmorphic');
	const heroImageUrl = $derived(readHeroImageUrl(themeConfig));
	const heroPreviewSrc = $derived(mediaUrl(heroImageUrl));
	const showHeroUrlField = $derived(
		pasteHeroUrl || /^https?:\/\//i.test(heroImageUrl.trim())
	);

	$effect(() => {
		if (!jsonTouched) {
			jsonText = themeConfig ? JSON.stringify(themeConfig, null, 2) : '';
		}
	});

	function readHeroImageUrl(cfg: ThemeConfig | null): string {
		const hero = cfg?.content?.hero;
		if (!hero || typeof hero !== 'object') return '';
		const url = (hero as { image_url?: unknown }).image_url;
		return typeof url === 'string' ? url : '';
	}

	function patchThemeConfig(nextConfig: ThemeConfig) {
		jsonTouched = false;
		themeConfig = nextConfig;
		onThemeConfigChange(nextConfig);
	}

	function setHeroImageUrl(url: string) {
		const trimmed = url.trim();
		const prevContent =
			themeConfig?.content && typeof themeConfig.content === 'object'
				? { ...themeConfig.content }
				: {};
		const prevHero =
			prevContent.hero && typeof prevContent.hero === 'object'
				? { ...(prevContent.hero as Record<string, unknown>) }
				: {};

		if (trimmed) {
			prevHero.image_url = trimmed;
			delete prevHero.image_project_id;
		} else {
			delete prevHero.image_url;
		}

		const recipe: ThemeRecipe =
			themeConfig?.recipe && themeConfig.recipe !== 'classic'
				? themeConfig.recipe
				: layout !== 'classic'
					? layout
					: 'photo-hero';

		patchThemeConfig({
			version: 1,
			recipe,
			skin: themeConfig?.skin,
			content: { ...prevContent, hero: prevHero },
			chrome: themeConfig?.chrome
		});
	}

	function uploadErrorMessage(err: unknown): string {
		if (err instanceof ApiError) {
			try {
				const parsed = JSON.parse(err.message) as { message?: string; error?: string };
				if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
				if (typeof parsed.error === 'string' && parsed.error.trim()) {
					if (parsed.error === 'upload not implemented yet') {
						return 'Image upload is not available on this API yet.';
					}
					return parsed.error;
				}
			} catch {
				if (err.message && !err.message.startsWith('<')) return err.message.slice(0, 160);
			}
		}
		return 'Image upload failed — try JPEG, PNG, or WebP under 3 MB';
	}

	async function uploadHeroFile(file: File) {
		heroUploading = true;
		try {
			const res = await uploadProjectImage(file);
			pasteHeroUrl = false;
			setHeroImageUrl(res.url);
			showToast('Hero photo uploaded', 'success');
		} catch (err) {
			showToast(uploadErrorMessage(err), 'error');
		} finally {
			heroUploading = false;
		}
	}

	async function onHeroImageFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) await uploadHeroFile(file);
	}

	function onHeroDragEnter(e: DragEvent) {
		e.preventDefault();
		heroDragDepth += 1;
		heroDragging = true;
	}

	function onHeroDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}

	function onHeroDragLeave(e: DragEvent) {
		e.preventDefault();
		heroDragDepth = Math.max(0, heroDragDepth - 1);
		if (heroDragDepth === 0) heroDragging = false;
	}

	async function onHeroDrop(e: DragEvent) {
		e.preventDefault();
		heroDragDepth = 0;
		heroDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) await uploadHeroFile(file);
	}

	function clearHeroImage() {
		pasteHeroUrl = false;
		setHeroImageUrl('');
	}

	function onHeroUrlInput(e: Event) {
		setHeroImageUrl((e.currentTarget as HTMLInputElement).value);
	}

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

	{#if showHeroPhoto}
		<div class="hero-photo">
			<span class="label">Hero photo</span>
			<p class="hint">Shown in the layout hero. Save the portfolio to publish.</p>
			<input
				bind:this={heroImageInput}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				hidden
				disabled={heroUploading}
				onchange={onHeroImageFile}
			/>
			<div
				class={[
					'dropzone',
					{
						filled: Boolean(heroPreviewSrc),
						dragging: heroDragging,
						busy: heroUploading
					}
				]}
				role="button"
				tabindex="0"
				aria-label={heroPreviewSrc ? 'Replace hero photo' : 'Upload hero photo'}
				onclick={() => !heroUploading && heroImageInput?.click()}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						if (!heroUploading) heroImageInput?.click();
					}
				}}
				ondragenter={onHeroDragEnter}
				ondragover={onHeroDragOver}
				ondragleave={onHeroDragLeave}
				ondrop={onHeroDrop}
			>
				{#if heroPreviewSrc}
					<img class="dropzone-img" src={heroPreviewSrc} alt="" />
					<div class="dropzone-veil">
						<span class="dropzone-cta"
							>{heroUploading ? 'Uploading…' : 'Drop to replace, or click'}</span
						>
					</div>
				{:else}
					<svg
						class="dropzone-icon"
						width="28"
						height="28"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<rect
							x="3"
							y="5"
							width="18"
							height="14"
							rx="2.5"
							stroke="currentColor"
							stroke-width="1.6"
						/>
						<circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
						<path
							d="M7 17l3.4-3.8a1.2 1.2 0 0 1 1.8 0L16 17h2l-4.2-5.2a1.6 1.6 0 0 0-2.5 0L7 17z"
							fill="currentColor"
						/>
					</svg>
					<strong
						>{heroUploading ? 'Uploading…' : heroDragging ? 'Drop image' : 'Drop image here'}</strong
					>
					<span>or click to browse · JPEG, PNG, WebP · 3 MB max</span>
				{/if}
			</div>
			{#if heroPreviewSrc}
				<div class="dropzone-bar">
					<button
						type="button"
						class="chip"
						disabled={heroUploading}
						onclick={(e) => {
							e.stopPropagation();
							heroImageInput?.click();
						}}
					>
						Change
					</button>
					<button
						type="button"
						class="chip danger"
						disabled={heroUploading}
						onclick={(e) => {
							e.stopPropagation();
							clearHeroImage();
						}}
					>
						Remove
					</button>
				</div>
			{/if}
			{#if showHeroUrlField}
				<label class="field">
					<span class="label">Image URL</span>
					<input
						type="url"
						value={heroImageUrl}
						placeholder="https://…"
						oninput={onHeroUrlInput}
					/>
				</label>
			{:else}
				<button type="button" class="url-toggle" onclick={() => (pasteHeroUrl = true)}>
					Or paste an image URL
				</button>
			{/if}
			{#if !heroPreviewSrc}
				<p class="hint">Without a photo, the layout may use the first project image.</p>
			{/if}
		</div>
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
	.json,
	.hero-photo input[type='url'] {
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
	.hero-photo {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.dropzone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 9.5rem;
		padding: 1.1rem;
		border: 1.5px dashed var(--line, #e7e5e4);
		border-radius: 0.65rem;
		background: var(--bg-muted, #f5f5f4);
		color: var(--muted, #78716c);
		text-align: center;
		cursor: pointer;
		overflow: hidden;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			box-shadow 0.15s ease;
	}
	.dropzone:hover,
	.dropzone:focus-visible {
		border-color: var(--accent, #0f766e);
		outline: none;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #0f766e) 18%, transparent);
	}
	.dropzone.dragging {
		border-style: solid;
		border-color: var(--accent, #0f766e);
		background: color-mix(in srgb, var(--accent, #0f766e) 10%, var(--surface, #fff));
	}
	.dropzone.busy {
		pointer-events: none;
		opacity: 0.75;
	}
	.dropzone.filled {
		padding: 0;
		border-style: solid;
		background: var(--surface, #fff);
	}
	.dropzone-icon {
		color: var(--accent, #0f766e);
		margin-bottom: 0.15rem;
	}
	.dropzone strong {
		color: inherit;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.dropzone span {
		font-size: 0.75rem;
	}
	.dropzone-img {
		display: block;
		width: 100%;
		height: 9.5rem;
		object-fit: cover;
	}
	.dropzone-veil {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, #0f172a 48%, transparent);
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.dropzone.filled:hover .dropzone-veil,
	.dropzone.filled:focus-visible .dropzone-veil,
	.dropzone.dragging .dropzone-veil,
	.dropzone.busy .dropzone-veil {
		opacity: 1;
	}
	.dropzone-cta {
		color: #fff !important;
		font-size: 0.8125rem !important;
		font-weight: 600;
	}
	.dropzone-bar {
		display: flex;
		gap: 0.4rem;
	}
	.chip {
		padding: 0.28rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--line, #e7e5e4);
		background: var(--surface, #fff);
		color: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--accent, #0f766e);
		color: var(--accent, #0f766e);
	}
	.chip.danger:hover:not(:disabled) {
		border-color: color-mix(in srgb, #b91c1c 35%, var(--line, #e7e5e4));
		color: #b91c1c;
		background: #fef2f2;
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.url-toggle {
		align-self: flex-start;
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted, #78716c);
		font-size: 0.8125rem;
		cursor: pointer;
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
