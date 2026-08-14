import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const corePkg = JSON.parse(readFileSync(resolve(root, 'apps/core/package.json'), 'utf8')) as {
	version?: string;
};
const foliyoVersion = corePkg.version ?? '0.0.0';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		// Bake the OSS release version into the dashboard (matches foliyo tag / @foliyo/core).
		__FOLIYO_VERSION__: JSON.stringify(foliyoVersion)
	},
	ssr: {
		// Compile workspace Svelte/CSS packages in the app bundle
		noExternal: ['@foliyo/ui', '@foliyo/brand']
	}
});
