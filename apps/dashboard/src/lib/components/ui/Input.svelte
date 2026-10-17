<script lang="ts">
	type AutocompleteAttribute = HTMLInputElement['autocomplete'] | undefined;

	export let label = '';
	export let type = 'text';
	export let value = '';
	export let name = '';
	export let placeholder = '';
	export let disabled = false;
	export let autocomplete: AutocompleteAttribute = undefined;

	/** Svelte 5 callback props (preferred over on:input forwarding). */
	export let oninput: ((e: Event) => void) | undefined = undefined;
	export let onfocus: ((e: FocusEvent) => void) | undefined = undefined;
</script>

<label>
	{#if label}<span class="label">{label}</span>{/if}
	{#if type === 'password'}
		<input
			type="password"
			{name}
			{placeholder}
			{disabled}
			{autocomplete}
			bind:value
			on:input={oninput}
			on:focus={onfocus}
			on:input
			on:focus
		/>
	{:else if type === 'email'}
		<input
			type="email"
			{name}
			{placeholder}
			{disabled}
			{autocomplete}
			bind:value
			on:input={oninput}
			on:focus={onfocus}
			on:input
			on:focus
		/>
	{:else}
		<input
			type="text"
			{name}
			{placeholder}
			{disabled}
			{autocomplete}
			bind:value
			on:input={oninput}
			on:focus={onfocus}
			on:input
			on:focus
		/>
	{/if}
</label>

<style>
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}
	input {
		min-height: var(--control-height);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
	}
	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	input:focus {
		border-color: var(--color-primary-muted);
		box-shadow: var(--focus-ring);
		outline: none;
	}
</style>
