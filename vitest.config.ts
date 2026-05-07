import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		environmentMatchGlobs: [
			['src/lib/components/**/*.test.ts', 'jsdom'],
			['src/routes/**/*.test.ts', 'jsdom']
		],
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 70,
				statements: 80
			}
		}
	}
});
