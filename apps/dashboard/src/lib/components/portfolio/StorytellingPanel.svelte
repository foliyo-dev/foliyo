<script lang="ts">
	import Input from '$lib/components/ui/Input.svelte';
	import { projectsLayoutOptions } from '$lib/api/portfolios';

	let {
		projectsLayout = $bindable('featured_timeline' as 'cards' | 'featured_timeline' | 'timeline'),
		showSkillLevels = $bindable(false),
		heroCtaPrimary = $bindable(''),
		heroCtaSecondary = $bindable(''),
		showPreset = false,
		onApplyDeveloperPreset = undefined as (() => void) | undefined
	} = $props();
</script>

<div class="story">
	{#if showPreset && onApplyDeveloperPreset}
		<div class="preset">
			<div>
				<strong>Developer site preset</strong>
				<p class="hint">
					Projects first (featured + timeline), skill levels off, education/certs hidden, hero CTAs
					set to View work / Contact.
				</p>
			</div>
			<button type="button" class="preset-btn" onclick={onApplyDeveloperPreset}>Apply</button>
		</div>
	{/if}

	<label class="field">
		<span class="label">Projects layout</span>
		<select bind:value={projectsLayout}>
			{#each projectsLayoutOptions as opt (opt.id)}
				<option value={opt.id}>{opt.label} — {opt.hint}</option>
			{/each}
		</select>
	</label>

	<label class="checkbox">
		<input type="checkbox" bind:checked={showSkillLevels} />
		Show skill proficiency levels (beginner / expert)
	</label>

	<div class="cta-row">
		<Input label="Hero CTA (primary)" bind:value={heroCtaPrimary} placeholder="View work" />
		<Input label="Hero CTA (secondary)" bind:value={heroCtaSecondary} placeholder="Contact" />
	</div>
	<p class="hint">
		Primary scrolls to Projects; secondary opens email when Basics has an address. Leave blank to hide.
	</p>
</div>

<style>
	.story {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.preset {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg, transparent);
	}
	.preset strong {
		font-size: 0.875rem;
	}
	.preset-btn {
		flex-shrink: 0;
		min-height: var(--control-height);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}
	.preset-btn:hover {
		border-color: var(--color-accent, var(--color-border));
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 500;
	}
	select {
		min-height: var(--control-height);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		font: inherit;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.8125rem;
	}
	.cta-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-muted);
		line-height: 1.4;
	}
	@media (max-width: 640px) {
		.cta-row {
			grid-template-columns: 1fr;
		}
		.preset {
			flex-direction: column;
		}
	}
</style>
