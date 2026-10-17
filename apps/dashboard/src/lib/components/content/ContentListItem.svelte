<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';

	/** Shown as a default "Edit" button in the actions area, unless the `actions` slot is used instead. */
	export let onEdit: (() => void) | undefined = undefined;
	/** Shown as a default "Delete" button in the actions area, unless the `actions` slot is used instead. */
	export let onRemove: (() => void) | undefined = undefined;
	export let onMoveUp: (() => void) | undefined = undefined;
	export let onMoveDown: (() => void) | undefined = undefined;
	export let align: 'flex-start' | 'center' = 'flex-start';
</script>

<li>
	<div class="item-row" style:align-items={align}>
		<div class="detail">
			<slot />
		</div>
		<div class="row-actions">
			<slot name="actions">
				{#if onMoveUp || onMoveDown}
					<Button variant="ghost" size="sm" disabled={!onMoveUp} on:click={() => onMoveUp?.()}>↑</Button>
					<Button variant="ghost" size="sm" disabled={!onMoveDown} on:click={() => onMoveDown?.()}
						>↓</Button
					>
				{/if}
				{#if onEdit}
					<Button variant="ghost" size="sm" on:click={onEdit}>Edit</Button>
				{/if}
				{#if onRemove}
					<Button variant="ghost" size="sm" on:click={onRemove}>Delete</Button>
				{/if}
			</slot>
		</div>
	</div>
</li>

<style>
	.item-row {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
	}
	.detail {
		min-width: 0;
		flex: 1;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.detail :global(.meta) {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-muted);
		margin-top: 0.15rem;
	}
	.detail :global(.desc) {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
	}
	.detail :global(strong) {
		font-size: 0.875rem;
	}

	@media (min-width: 640px) {
		.item-row {
			flex-direction: row;
			justify-content: space-between;
			gap: var(--space-4);
		}
		.row-actions {
			flex-shrink: 0;
			justify-content: flex-end;
			align-self: center;
		}
	}
</style>
