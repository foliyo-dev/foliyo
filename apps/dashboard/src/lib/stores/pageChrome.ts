import { writable } from 'svelte/store';

export type PageChrome = {
	title: string;
	description: string;
};

export const pageChrome = writable<PageChrome>({
	title: '',
	description: ''
});

export function setPageChrome(title: string, description = '') {
	pageChrome.set({ title, description });
}

export function clearPageChrome() {
	pageChrome.set({ title: '', description: '' });
}
