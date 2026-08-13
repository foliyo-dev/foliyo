<script lang="ts">
	import { confirmState } from '$lib/stores/confirm';
	import Button from './Button.svelte';

	let dialog: HTMLDialogElement | undefined;

	$: open = Boolean($confirmState);
	$: if (dialog) {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}

	function cancel() {
		$confirmState?.resolve(false);
	}

	function confirm() {
		$confirmState?.resolve(true);
	}

	function onBackdrop(e: MouseEvent) {
		if (e.target === dialog) cancel();
	}
</script>

<dialog
	bind:this={dialog}
	class="confirm"
	aria-labelledby="confirm-title"
	aria-describedby="confirm-message"
	on:cancel|preventDefault={cancel}
	on:click={onBackdrop}
>
	{#if $confirmState}
		<h2 id="confirm-title">{$confirmState.title}</h2>
		<p id="confirm-message">{$confirmState.message}</p>
		<div class="actions">
			<Button variant="ghost" on:click={cancel}>Cancel</Button>
			<Button on:click={confirm}>{$confirmState.confirmLabel}</Button>
		</div>
	{/if}
</dialog>

<style>
	dialog.confirm {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 1.25rem 1.35rem;
		max-width: min(22rem, calc(100vw - 2rem));
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 12px 40px rgba(26, 26, 46, 0.16);
	}
	dialog.confirm::backdrop {
		background: rgba(15, 23, 42, 0.4);
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	p {
		margin: 0 0 1.15rem;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
