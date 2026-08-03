import { writable } from 'svelte/store';

export type Toast = { id: number; message: string; type: 'info' | 'error' | 'success' };

let nextId = 0;
export const toasts = writable<Toast[]>([]);

export function showToast(message: string, type: Toast['type'] = 'info') {
  const id = ++nextId;
  toasts.update((t) => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update((t) => t.filter((x) => x.id !== id));
  }, 4000);
}
