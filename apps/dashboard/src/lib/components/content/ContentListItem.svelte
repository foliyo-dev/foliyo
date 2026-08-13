<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	/** Shown as a default "Edit" button in the actions area, unless the `actions` slot is used instead. */
	export let onEdit: (() => void) | undefined = undefined;
	/** Shown as a default "Delete" button in the actions area, unless the `actions` slot is used instead. */
	export let onRemove: (() => void) | undefined = undefined;
	export let align: 'flex-start' | 'center' = 'flex-start';
</script>

<li>
	<Card>
		<div class="item-row" class:align-center={align === 'center'}>
			<div class="detail">
				<slot />
			</div>
			<div class="row-actions">
				<slot name="actions">
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
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.item-row.align-center {
		align-items: center;
	}
	.detail {
		min-width: 0;
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
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
