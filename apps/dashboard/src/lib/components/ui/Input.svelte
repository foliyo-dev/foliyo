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
		gap: 0.25rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}
	input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
	}
	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	input:focus {
		border-color: var(--color-primary-muted);
		box-shadow: 0 0 0 3px var(--color-primary-light);
		outline: none;
	}
</style>
