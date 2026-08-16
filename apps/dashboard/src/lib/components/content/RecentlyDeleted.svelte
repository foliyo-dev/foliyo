<script lang="ts">
	import { onMount } from 'svelte';
	import { ApiError } from '$lib/api/client';
	import Button from '$lib/components/ui/Button.svelte';
	import { showToast } from '$lib/stores/toast';
	import { requestConfirm } from '$lib/stores/confirm';

	type TrashItem = { id: string; deleted_at?: string | null };

	export let listDeleted: () => Promise<TrashItem[]>;
	export let restore: (id: string) => Promise<void>;
	export let purge: (id: string) => Promise<void>;
	export let getLabel: (item: TrashItem) => string;
	export let entityLabel = 'item';
	/** Called after restore so the parent list can reload. */
	export let onRestored: (() => void | Promise<void>) | undefined = undefined;

	let items: TrashItem[] = [];
	let loading = true;
	let busyId: string | null = null;

	onMount(load);

	export async function reload() {
		await load();
	}

	async function load() {
		loading = true;
		try {
			items = await listDeleted();
		} catch {
			items = [];
		} finally {
			loading = false;
		}
	}

	async function doRestore(item: TrashItem) {
		busyId = item.id;
		try {
			await restore(item.id);
			items = items.filter((i) => i.id !== item.id);
			showToast(`${entityLabel} restored`, 'success');
			await onRestored?.();
		} catch (err) {
			const msg =
				err instanceof ApiError && err.status === 409
					? `Could not restore — an active ${entityLabel.toLowerCase()} with the same name already exists`
					: `Failed to restore ${entityLabel.toLowerCase()}`;
			showToast(msg, 'error');
		} finally {
			busyId = null;
		}
	}

	async function doPurge(item: TrashItem) {
		const ok = await requestConfirm({
			title: `Delete forever?`,
			message: `“${getLabel(item)}” will be permanently removed. This cannot be undone.`,
			confirmLabel: 'Delete forever'
		});
		if (!ok) return;
		busyId = item.id;
		try {
			await purge(item.id);
			items = items.filter((i) => i.id !== item.id);
			showToast(`${entityLabel} permanently deleted`, 'success');
		} catch {
			showToast(`Failed to permanently delete`, 'error');
		} finally {
			busyId = null;
		}
	}

	function formatDeletedAt(iso: string | null | undefined) {
		if (!iso) return '';
		const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

{#if loading}
	<!-- keep quiet while first load -->
{:else if items.length > 0}
	<details class="trash">
		<summary>Recently deleted ({items.length})</summary>
		<p class="hint">Kept for 30 days. Restore to put them back in your library, or delete forever.</p>
		<ul class="list">
			{#each items as item (item.id)}
				<li>
					<div class="meta">
						<strong>{getLabel(item)}</strong>
						{#if item.deleted_at}
							<span class="when">Deleted {formatDeletedAt(item.deleted_at)}</span>
						{/if}
					</div>
					<div class="actions">
						<Button
							variant="ghost"
							disabled={busyId === item.id}
							on:click={() => doRestore(item)}
						>
							Restore
						</Button>
						<Button
							variant="ghost"
							disabled={busyId === item.id}
							on:click={() => doPurge(item)}
						>
							Delete forever
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	</details>
{/if}

<style>
	.trash {
		margin: 0 0 1rem;
		padding: 0.85rem 1rem;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
	}
	.trash summary {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-muted);
	}
	.hint {
		margin: 0.5rem 0 0.75rem;
		font-size: 0.75rem;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0.5rem 0;
		border-top: 1px solid var(--color-border);
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.meta strong {
		font-size: 0.875rem;
	}
	.when {
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.actions {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}
</style>
