import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		paths: {
			base: '/webapp',
			relative: false
			// assets: '/webapp'  // only if assets are served from a different origin (e.g. CDN)
		}
	}
};

export default config;
