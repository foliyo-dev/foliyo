<script lang="ts">
	let {
		label,
		value = $bindable(),
		placeholder = 'Type a skill and press Enter',
		disabled = false,
		id
	}: {
		label: string;
		value: string[];
		placeholder?: string;
		disabled?: boolean;
		id?: string;
	} = $props();

	let draft = $state('');
	const inputId = $derived(id ?? `skill-tags-${label.replace(/\s+/g, '-').toLowerCase()}`);

	function isDuplicate(skill: string): boolean {
		const lower = skill.toLowerCase();
		return value.some((s) => s.toLowerCase() === lower);
	}

	function addSkill(raw: string) {
		const trimmed = raw.trim();
		if (!trimmed || isDuplicate(trimmed)) return;
		value = [...value, trimmed];
	}

	function commitDraft() {
		if (!draft.trim()) {
			draft = '';
			return;
		}
		addSkill(draft);
		draft = '';
	}

	function removeSkill(skill: string) {
		value = value.filter((s) => s !== skill);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commitDraft();
			return;
		}
		if (e.key === 'Backspace' && draft === '' && value.length > 0) {
			e.preventDefault();
			value = value.slice(0, -1);
		}
	}

	function onBlur() {
		commitDraft();
	}
</script>

<div class="field">
	{#if label}
		<label class="label" for={inputId}>{label}</label>
	{/if}
	<div class="control" class:disabled aria-disabled={disabled || undefined}>
		{#each value as skill (skill)}
			<span class="chip">
				{skill}
				<button
					type="button"
					class="remove"
					aria-label="Remove {skill}"
					{disabled}
					onclick={() => removeSkill(skill)}
				>
					×
				</button>
			</span>
		{/each}
		<input
			id={inputId}
			type="text"
			{placeholder}
			{disabled}
			bind:value={draft}
			onkeydown={onKeydown}
			onblur={onBlur}
		/>
	</div>
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}
	.control {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: text;
	}
	.control:focus-within {
		border-color: var(--color-primary-muted);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}
	.control.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		max-width: 100%;
		padding: 0.15rem 0.2rem 0.15rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-primary-light);
		color: var(--color-primary);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.3;
	}
	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: inherit;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}
	.remove:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
	}
	.remove:disabled {
		cursor: not-allowed;
	}
	input {
		flex: 1 1 8rem;
		min-width: 8rem;
		padding: 0.25rem 0.35rem;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		outline: none;
	}
	input:disabled {
		cursor: not-allowed;
	}
</style>
