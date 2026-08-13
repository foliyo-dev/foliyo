import { writable } from 'svelte/store';

export type ConfirmRequest = {
	title: string;
	message: string;
	confirmLabel: string;
	resolve: (ok: boolean) => void;
};

export const confirmState = writable<ConfirmRequest | null>(null);

export function requestConfirm(opts: {
	title: string;
	message: string;
	confirmLabel?: string;
}): Promise<boolean> {
	return new Promise((resolve) => {
		confirmState.update((prev) => {
			prev?.resolve(false);
			return {
				title: opts.title,
				message: opts.message,
				confirmLabel: opts.confirmLabel ?? 'Confirm',
				resolve: (ok) => {
					confirmState.set(null);
					resolve(ok);
				}
			};
		});
	});
}

export function confirmDelete(itemLabel: string): Promise<boolean> {
	return requestConfirm({
		title: `Delete ${itemLabel}?`,
		message: 'This cannot be undone.',
		confirmLabel: 'Delete'
	});
}
