import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Keep prerendered index.html; serve 200.html for non-prerendered SPA routes.
			fallback: '200.html'
		}),
		paths: {
			base: '',
			relative: false
		}
	}
};

export default config;
