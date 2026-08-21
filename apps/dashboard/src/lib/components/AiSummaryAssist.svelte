<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import { isSaas } from '$lib/config';
	import { generateResumeSummary } from '$lib/api/ai';
	import { parseUpgradeError } from '$lib/api/plan';
	import { showToast } from '$lib/stores/toast';
	import { createEventDispatcher } from 'svelte';

	export let headline = '';
	export let bio = '';
	export let jdText = '';
	export let skillNames: string[] = [];
	export let disabled = false;
	export let pro = false;
	export let outOfUnits = false;
	export let unitsHint = '';

	const dispatch = createEventDispatcher<{ upgrade: string; generated: void }>();

	let busy = false;
	let errorMsg = '';

	$: canGenerate =
		isSaas && pro && !disabled && !busy && !outOfUnits && jdText.trim().length > 0;

	async function generate() {
		if (!pro) {
			const msg = 'Resume summary generation is a Pro feature';
			dispatch('upgrade', msg);
			showToast(msg, 'error');
			return;
		}
		if (!canGenerate) return;
		busy = true;
		errorMsg = '';
		try {
			const result = await generateResumeSummary({
				jd_text: jdText.trim(),
				skill_names: skillNames.length ? skillNames : undefined
			});
			headline = result.headline ?? '';
			bio = result.bio ?? '';
			const left = result.meta.units_remaining;
			showToast(
				left != null ? `Summary generated · ${left} AI units left today` : 'Summary generated',
				'success'
			);
			dispatch('generated');
		} catch (err) {
			const upgrade = parseUpgradeError(err);
			if (upgrade) {
				dispatch('upgrade', upgrade.message);
				errorMsg = upgrade.message;
				showToast(upgrade.message, 'error');
			} else {
				const msg =
					err instanceof Error
						? err.message
						: typeof err === 'object' && err && 'message' in err
							? String((err as { message: string }).message)
							: 'Summary generation failed';
				try {
					const parsed = JSON.parse(msg) as { message?: string; error?: string };
					errorMsg = parsed.message || parsed.error || msg;
				} catch {
					errorMsg = msg;
				}
				showToast(errorMsg, 'error');
			}
		} finally {
			busy = false;
		}
	}

	function requestUpgrade() {
		const msg = 'Upgrade to Pro to generate a resume headline and summary';
		dispatch('upgrade', msg);
	}
</script>

<div class="assist" class:busy>
	<div class="toolbar">
		<div class="brand">
			<span class="ai-badge">AI</span>
			<div class="brand-copy">
				<span class="title">Resume summary</span>
				<span class="meta">
					{#if unitsHint}
						{unitsHint}
					{:else}
						Uses your library + JD · does not invent skills · 1 AI unit when generated
					{/if}
				</span>
			</div>
		</div>

		{#if isSaas && pro}
			<Button
				variant="secondary"
				disabled={!canGenerate}
				on:click={generate}
			>
				{#if busy}
					Generating…
				{:else if outOfUnits}
					Out of AI units
				{:else}
					Generate with AI
				{/if}
			</Button>
		{:else if isSaas}
			<button type="button" class="nudge" on:click={requestUpgrade}>
				Pro · generate headline &amp; summary
			</button>
		{/if}
	</div>

	<p class="hint">
		Uses your library + JD. Does not invent skills. Costs 1 AI unit when generated. You can edit
		anytime.
	</p>

	{#if errorMsg}
		<p class="error" role="alert">{errorMsg}</p>
	{/if}

	<div class="fields">
		<Input
			label="Headline"
			bind:value={headline}
			placeholder="e.g. Full-stack engineer focused on product delivery"
			disabled={disabled || busy}
		/>
		<div class="bio-wrap" class:dim={disabled || busy}>
			<Textarea
				label="Professional summary"
				bind:value={bio}
				rows={4}
				placeholder="Short summary tailored to this role…"
			/>
		</div>
	</div>
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

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg);
	}
	.bio-wrap.dim {
		opacity: 0.6;
		pointer-events: none;
	}
</style>
