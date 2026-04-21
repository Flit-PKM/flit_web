import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },

		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Disable navigation rules for SvelteKit - goto() works without resolve() in client-side navigation
			'svelte/no-navigation-without-resolve': 'off',
			// Disable writable derived rule - current pattern is correct for state updates in effects
			'svelte/prefer-writable-derived': 'off'
		}
	},
	// Sanitized {@html} (markdownToSafeHtml) in notes pages
	{
		files: ['**/notes/**/+page.svelte'],
		rules: { 'svelte/no-at-html-tags': 'off' }
	},
	// SvelteMap/SvelteSet need $state for assignment updates to trigger reactivity
	{
		files: ['src/routes/(protected)/notes/**/+page.svelte'],
		rules: { 'svelte/no-unnecessary-state-wrap': 'off' }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],

		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
