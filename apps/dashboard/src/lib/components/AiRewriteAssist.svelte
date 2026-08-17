<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { isSaas } from '$lib/config';
	import { rewriteBullet, type RewriteTone } from '$lib/api/ai';
	import { parseUpgradeError } from '$lib/api/plan';
	import { showToast } from '$lib/stores/toast';
	import { createEventDispatcher } from 'svelte';

	/** Bound text field to rewrite in place after accept. */
	export let value = '';
	export let jdContext = '';
	export let disabled = false;

	const dispatch = createEventDispatcher<{ upgrade: string }>();

	const tones: Array<{ id: RewriteTone; label: string; hint: string }> = [
		{ id: 'stronger', label: 'Stronger', hint: 'More impact, same facts' },
		{ id: 'shorter', label: 'Shorter', hint: 'Tighter wording' },
		{ id: 'metrics', label: 'Metrics', hint: 'Keep numbers, sharpen impact' }
	];

	let busy: RewriteTone | null = null;
	let suggestion = '';
	let usedTone: RewriteTone | null = null;
	let unitsLeft: number | null = null;
	let errorMsg = '';

	$: trimmedLen = value.trim().length;
	$: tooShort = trimmedLen > 0 && trimmedLen < 24;
	$: canRewrite = isSaas && trimmedLen >= 24 && !disabled && busy === null;
	$: showPanel = Boolean(suggestion) || busy !== null;

	async function run(tone: RewriteTone) {
		if (!canRewrite) return;
		busy = tone;
		suggestion = '';
		errorMsg = '';
		usedTone = tone;
		try {
			const result = await rewriteBullet({
				text: value,
				tone,
				jd_text: jdContext.trim() || undefined
			});
			suggestion = result.text;
			unitsLeft = result.meta.units_remaining;
		} catch (err) {
			usedTone = null;
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
							: 'Rewrite failed';
				try {
					const parsed = JSON.parse(msg) as { message?: string; error?: string };
					errorMsg = parsed.message || parsed.error || msg;
				} catch {
					errorMsg = msg;
				}
				showToast(errorMsg, 'error');
			}
		} finally {
			busy = null;
		}
	}

	function accept() {
		if (!suggestion) return;
		value = suggestion;
		suggestion = '';
		usedTone = null;
		showToast(
			unitsLeft != null ? `Applied · ${unitsLeft} AI units left today` : 'Applied rewrite',
			'success'
		);
	}

	function dismiss() {
		suggestion = '';
		usedTone = null;
		errorMsg = '';
	}

	function retry() {
		if (usedTone) run(usedTone);
	}
</script>

{#if isSaas}
	<div class="assist" class:open={showPanel} class:busy={busy !== null}>
		<div class="toolbar">
			<div class="brand">
				<span class="ai-badge">AI</span>
				<div class="brand-copy">
					<span class="title">Rewrite</span>
					{#if unitsLeft != null}
						<span class="meta">{unitsLeft} units left</span>
					{:else if tooShort}
						<span class="meta warn">Need ~24+ characters</span>
					{:else}
						<span class="meta">1 unit · review before apply</span>
					{/if}
				</div>
			</div>

			<div class="tones" role="group" aria-label="Rewrite tone">
				{#each tones as t}
					<button
						type="button"
						class="tone"
						class:on={usedTone === t.id && Boolean(suggestion)}
						class:loading={busy === t.id}
						disabled={!canRewrite && busy !== t.id}
						title={t.hint}
						aria-pressed={usedTone === t.id && Boolean(suggestion)}
						on:click={() => run(t.id)}
					>
						{#if busy === t.id}
							<span class="spinner" aria-hidden="true"></span>
							<span>Writing…</span>
						{:else}
							{t.label}
						{/if}
					</button>
				{/each}
			</div>
		</div>

		{#if errorMsg && !suggestion}
			<p class="error" role="alert">{errorMsg}</p>
		{/if}

		{#if busy && !suggestion}
			<div class="skeleton" aria-busy="true" aria-live="polite">
				<div class="skel-line"></div>
				<div class="skel-line short"></div>
				<div class="skel-line mid"></div>
				<p class="skel-label">Rewriting with {usedTone}…</p>
			</div>
		{/if}

		{#if suggestion}
			<div class="result" role="status">
				<div class="compare">
					<div class="col original">
						<span class="col-label">Current</span>
						<p class="col-text">{value}</p>
					</div>
					<div class="col proposed">
						<span class="col-label">
							Suggestion
							{#if usedTone}
								<span class="tone-pill">{usedTone}</span>
							{/if}
						</span>
						<p class="col-text">{suggestion}</p>
					</div>
				</div>
				<div class="result-actions">
					<Button on:click={accept}>Use suggestion</Button>
					<Button variant="secondary" on:click={retry} disabled={busy !== null || !usedTone}>
						Try again
					</Button>
					<button type="button" class="discard" on:click={dismiss}>Discard</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.assist {
		margin-top: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		overflow: hidden;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	.assist.open {
		border-color: color-mix(in srgb, var(--color-primary-muted) 55%, var(--color-border));
		box-shadow: 0 1px 0 color-mix(in srgb, var(--color-primary-light) 80%, transparent);
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
	.meta.warn {
		color: #b45309;
	}

	.tones {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		padding: 0.2rem;
		border-radius: 999px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
	}
	.tone {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}
	.tone:hover:not(:disabled) {
		background: var(--color-surface);
		color: var(--color-primary);
	}
	.tone.on {
		background: var(--color-primary);
		color: #fff;
	}
	.tone:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.tone.loading {
		opacity: 1;
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.spinner {
		width: 0.7rem;
		height: 0.7rem;
		border: 1.5px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		margin: 0;
		padding: 0.55rem 0.75rem 0.7rem;
		font-size: 0.8125rem;
		color: var(--color-error);
		border-top: 1px solid var(--color-border);
		background: #fef2f2;
	}

	.skeleton {
		padding: 0.85rem 0.85rem 0.95rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg);
	}
	.skel-line {
		height: 0.55rem;
		border-radius: 4px;
		background: linear-gradient(
			90deg,
			var(--color-border) 0%,
			color-mix(in srgb, var(--color-primary-light) 80%, var(--color-border)) 50%,
			var(--color-border) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.1s ease-in-out infinite;
		margin-bottom: 0.45rem;
	}
	.skel-line.short {
		width: 62%;
	}
	.skel-line.mid {
		width: 84%;
		margin-bottom: 0.65rem;
	}
	.skel-label {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}

	.result {
		border-top: 1px solid var(--color-border);
		padding: 0.75rem;
		background: var(--color-bg);
	}
	.compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}
	.col {
		min-width: 0;
		padding: 0.65rem 0.7rem;
		border-radius: calc(var(--radius) - 2px);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.col.proposed {
		border-color: color-mix(in srgb, var(--color-primary-muted) 50%, var(--color-border));
		background: color-mix(in srgb, var(--color-primary-light) 55%, var(--color-surface));
	}
	.col-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.tone-pill {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 600;
		font-size: 0.625rem;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: var(--color-primary);
		color: #fff;
	}
	.col-text {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--color-text);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.col.original .col-text {
		color: var(--color-muted);
	}

	.result-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.75rem;
	}
	.discard {
		margin-left: auto;
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0.35rem 0.25rem;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.discard:hover {
		color: var(--color-text);
	}

	@media (max-width: 720px) {
		.toolbar {
			align-items: stretch;
			flex-direction: column;
		}
		.tones {
			width: 100%;
			justify-content: stretch;
		}
		.tone {
			flex: 1 1 auto;
			justify-content: center;
		}
		.compare {
			grid-template-columns: 1fr;
		}
		.discard {
			margin-left: 0;
		}
	}
</style>
