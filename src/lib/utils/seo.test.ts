import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DESCRIPTION,
	escapeJsonLd,
	buildWebPageGraph,
	wrapJsonLdGraph,
	SITE_NAME
} from './seo';

describe('seo utils', () => {
	it('escapeJsonLd neutralizes angle brackets', () => {
		const payload = { html: '<script>alert(1)</script>' };
		expect(escapeJsonLd(payload)).not.toContain('<script>');
		expect(escapeJsonLd(payload)).toContain('\\u003c');
	});

	it('buildWebPageGraph includes organization, website, and webpage nodes', () => {
		const graph = buildWebPageGraph({
			originUrl: 'https://core.flit-pkm.com/',
			pageUrl: 'https://core.flit-pkm.com/about',
			pageName: 'About - Flit Web',
			pageDescription: 'About page',
			logoUrl: 'https://core.flit-pkm.com/images/flit_app_logo.svg'
		});
		expect(graph).toHaveLength(3);
		expect(graph[0]).toMatchObject({ '@type': 'Organization', name: SITE_NAME });
		expect(graph[1]).toMatchObject({ '@type': 'WebSite', name: SITE_NAME });
		expect(graph[2]).toMatchObject({ '@type': 'WebPage', name: 'About - Flit Web' });
	});

	it('wrapJsonLdGraph adds schema context', () => {
		const wrapped = wrapJsonLdGraph([]);
		expect(wrapped['@context']).toBe('https://schema.org');
		expect(wrapped['@graph']).toEqual([]);
	});

	it('DEFAULT_DESCRIPTION is non-empty', () => {
		expect(DEFAULT_DESCRIPTION.length).toBeGreaterThan(20);
	});
});
