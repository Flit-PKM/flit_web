import { statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const origin = (process.env.VITE_SITE_ORIGIN || 'https://core.flit-pkm.com').replace(/\/$/, '');

/** @type {{ path: string; file: string; changefreq: string }[]} */
const routes = [
	{ path: '/', file: 'src/routes/+page.svelte', changefreq: 'weekly' },
	{ path: '/about', file: 'src/routes/about/+page.svelte', changefreq: 'monthly' },
	{ path: '/terms', file: 'src/routes/terms/+page.svelte', changefreq: 'monthly' },
	{ path: '/billing', file: 'src/routes/billing/+page.svelte', changefreq: 'monthly' }
];

function lastModFor(file) {
	try {
		return statSync(join(root, file)).mtime.toISOString().slice(0, 10);
	} catch {
		return new Date().toISOString().slice(0, 10);
	}
}

const urls = routes
	.map(({ path, file, changefreq }) => {
		const loc = `${origin}${path === '/' ? '/' : path}`;
		const lastmod = lastModFor(file);
		return `\t<url>\n\t\t<loc>${loc}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t\t<changefreq>${changefreq}</changefreq>\n\t</url>`;
	})
	.join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(join(root, 'static/sitemap.xml'), xml, 'utf8');
process.stdout.write(`Wrote sitemap.xml for ${origin} (${routes.length} URLs)\n`);
