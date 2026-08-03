import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		// Compile workspace Svelte/CSS packages in the app bundle
		noExternal: ['@foliyo/ui', '@foliyo/brand']
	}
});
