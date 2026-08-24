<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
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
	<Card>
		<div class="item-row">
			<div class="detail">
				<slot />
			</div>
			<div class="row-actions">
				<slot name="actions">
					{#if onMoveUp || onMoveDown}
						<Button variant="ghost" disabled={!onMoveUp} on:click={() => onMoveUp?.()}>↑</Button>
						<Button variant="ghost" disabled={!onMoveDown} on:click={() => onMoveDown?.()}>↓</Button>
					{/if}
					{#if onEdit}
						<Button variant="ghost" on:click={onEdit}>Edit</Button>
					{/if}
					{#if onRemove}
						<Button variant="ghost" on:click={onRemove}>Delete</Button>
					{/if}
				</slot>
			</div>
		</div>
	</Card>
</li>

<style>
	.item-row {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.75rem;
	}
	.detail {
		min-width: 0;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	/* Shared presentation for item-detail markup that pages render into the default slot. */
	.detail :global(.meta) {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-muted);
		margin-top: 0.25rem;
	}
	.detail :global(.desc) {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
	}
</style>
