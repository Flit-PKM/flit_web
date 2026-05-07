import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * TipTap is loaded behind a browser-only dynamic import (note detail page).
 * Without explicit `optimizeDeps.include`, Vite can discover those packages late and serve
 * bad/empty `.vite/deps/*` chunks — Firefox then reports NS_ERROR_CORRUPTED_CONTENT /
 * blank MIME type. Forcing inclusion warms esbuild deps at server start.
 */
const tiptapOptimizeDepsInclude = [
	'@tiptap/core',
	'@tiptap/starter-kit',
	'@tiptap/markdown',
	'@tiptap/extension-placeholder',
	'@tiptap/extension-table',
	'@tiptap/extension-table-row',
	'@tiptap/extension-table-cell',
	'@tiptap/extension-table-header',
	'@tiptap/extension-task-list',
	'@tiptap/extension-task-item',
	'marked'
];

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: tiptapOptimizeDepsInclude
	},
	ssr: {
		optimizeDeps: {
			include: tiptapOptimizeDepsInclude
		}
	}
});
