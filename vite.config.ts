import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	optimizeDeps: {
		include: ['@firebase/firestore', '@firebase/app', '@firebase/auth', '@lucide/svelte']
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		includeSource: ['src/**/*.{js,ts,svelte}'],
		exclude: ['**/node_modules/**', '**/dist/**', '**/.svelte-kit/**']
	}
});
