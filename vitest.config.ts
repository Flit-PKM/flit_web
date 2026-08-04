import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		environmentMatchGlobs: [
			['src/lib/components/**/*.test.ts', 'jsdom'],
			['src/lib/stores/**/*.test.ts', 'jsdom'],
			['src/lib/api/**/*.test.ts', 'jsdom'],
			['src/routes/**/*.test.ts', 'jsdom']
		],
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/lib/api/client.ts', 'src/lib/utils/**/*.ts', 'src/lib/stores/**/*.ts'],
			exclude: [
				'src/lib/**/*.test.ts',
				'src/lib/stores/confirmDialog.ts',
				'src/lib/stores/theme.ts',
				'src/lib/utils/markdown-preview-cache.ts'
			],
			thresholds: {
				lines: 65,
				functions: 60,
				branches: 70,
				statements: 65
			}
		}
	}
});
