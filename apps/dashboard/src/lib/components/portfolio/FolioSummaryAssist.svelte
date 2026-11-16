<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { generatePortfolioSummary } from '$lib/api/ai';
	import { hasProFeatures, parseUpgradeError } from '$lib/api/plan';
	import { isSaas } from '$lib/config';
	import { user } from '$lib/stores/auth';
	import { aiByok, aiConfigured, aiUsage, ensureAiUsage } from '$lib/stores/ai';
	import { showToast } from '$lib/stores/toast';

	let {
		headline = $bindable(''),
		bio = $bindable(''),
		skillIds = [] as string[],
		projectIds = [] as string[],
		experienceIds = [] as string[],
		educationIds = [] as string[]
	} = $props();

	let busy = $state(false);
	let errorMsg = $state('');

	onMount(() => {
		void ensureAiUsage();
	});

	const isPro = $derived(hasProFeatures($user?.plan, isSaas));
	const hasSelection = $derived(
		skillIds.length > 0 ||
			projectIds.length > 0 ||
			experienceIds.length > 0 ||
			educationIds.length > 0
	);
	const outOfUnits = $derived(
		isSaas && !$aiByok && $aiUsage != null && $aiUsage.remaining <= 0
	);
	const canGenerate = $derived(
		isPro && $aiConfigured && hasSelection && !busy && !outOfUnits
	);
	const unitsHint = $derived(
		$aiByok
			? 'Uses selected skills/projects/experience/education · does not invent · BYOK'
			: isSaas
				? 'Uses selected skills/projects/experience/education · does not invent · Pro · 1 AI unit'
				: 'Uses selected skills/projects/experience/education · does not invent'
	);

	async function generate() {
		if (!isPro) {
			const msg = 'Portfolio summary generation is a Pro feature';
			errorMsg = msg;
			showToast(msg, 'error');
			return;
		}
		if (!canGenerate) return;
		busy = true;
		errorMsg = '';
		try {
			const result = await generatePortfolioSummary({
				skill_ids: skillIds.length ? skillIds : undefined,
				project_ids: projectIds.length ? projectIds : undefined,
				experience_ids: experienceIds.length ? experienceIds : undefined,
				education_ids: educationIds.length ? educationIds : undefined
			});
			headline = result.headline ?? '';
			bio = result.bio ?? '';
			await ensureAiUsage(true);
			const left = result.meta.units_remaining;
			showToast(
				left != null ? `Summary drafted · ${left} AI units left today` : 'Summary drafted',
				'success'
			);
		} catch (err) {
			const upgrade = parseUpgradeError(err);
			if (upgrade) {
				errorMsg = upgrade.message;
				showToast(upgrade.message, 'error');
			} else {
				const raw =
					err instanceof Error
						? err.message
						: typeof err === 'object' && err && 'message' in err
							? String((err as { message: string }).message)
							: 'Summary generation failed';
				try {
					const parsed = JSON.parse(raw) as { message?: string; error?: string };
					errorMsg = parsed.message || parsed.error || raw;
				} catch {
					errorMsg = raw;
				}
				showToast(errorMsg, 'error');
			}
		} finally {
			busy = false;
		}
	}

	function requestUpgrade() {
		const msg = 'Upgrade to Pro to draft a folio headline and summary';
		errorMsg = msg;
		showToast(msg, 'error');
	}
</script>

<div class={['assist', { busy }]}>
	<div class="toolbar">
		<div class="brand">
			<span class="ai-badge">AI</span>
			<div class="brand-copy">
				<span class="title">Folio summary</span>
				<span class="meta">{unitsHint}</span>
			</div>
		</div>

		{#if $aiConfigured && isPro}
			<Button variant="secondary" size="sm" disabled={!canGenerate} on:click={generate}>
				{#if busy}
					Drafting…
				{:else if outOfUnits}
					Out of AI units
				{:else if !hasSelection}
					Select content first
				{:else}
					Draft from selected content
				{/if}
			</Button>
		{:else if isSaas}
			<button type="button" class="nudge" onclick={requestUpgrade}>
				Pro · draft from selected content
			</button>
		{/if}
	</div>

	<p class="hint">
		Uses selected skills, projects, experience, and education. Does not invent.
		{#if $aiByok}
			Uses your OpenRouter key (BYOK).
		{:else}
			Costs 1 AI unit when generated.
		{/if}
		You can edit anytime.
	</p>

	{#if errorMsg}
		<p class="error" role="alert">{errorMsg}</p>
	{/if}
</div>

<style>
	.assist {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		overflow: hidden;
	}
	.assist.busy {
		border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem 0.85rem;
		padding: 0.55rem 0.7rem;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--color-primary-light) 65%, var(--color-surface)) 0%,
			var(--color-surface) 100%
		);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}
	.ai-badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.6rem;
		height: 1.35rem;
		padding: 0 0.35rem;
		border-radius: 4px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		line-height: 1;
	}
	.brand-copy {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
	}
	.title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: -0.01em;
	}
	.meta {
		font-size: 0.6875rem;
		color: var(--color-muted);
		line-height: 1.3;
	}

	.nudge {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0.25rem 0;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.nudge:hover {
		color: var(--color-primary);
	}

	.hint {
		margin: 0;
		padding: 0.45rem 0.75rem 0.55rem;
		font-size: 0.75rem;
		color: var(--color-muted);
		line-height: 1.4;
		border-top: 1px solid var(--color-border);
	}

	.error {
		margin: 0;
		padding: 0.55rem 0.75rem;
		font-size: 0.8125rem;
		color: var(--color-error);
		border-top: 1px solid var(--color-border);
		background: #fef2f2;
	}
</style>
