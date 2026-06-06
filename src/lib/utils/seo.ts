/**
 * Shared SEO constants and JSON-LD helpers.
 */

export const SITE_NAME = 'Flit Web';

export const DEFAULT_DESCRIPTION =
	'Flit Web — personal note taking and knowledge management. Create notes, build relationships, categorize ideas, and sync across devices. Part of the Flit-PKM ecosystem.';

/** Static Open Graph / Twitter card image (1200×630 PNG). */
export const OG_IMAGE_PATH = '/Twitter_card3.png';

export const NOINDEX_ROBOTS = 'noindex, nofollow';

/** Crawlable marketing routes included in sitemap.xml. */
export const INDEXABLE_ROUTES = ['/', '/about', '/terms', '/billing'] as const;

export function escapeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function getSiteOrigin(pageOrigin: string): string {
	const configured = (import.meta.env.VITE_SITE_ORIGIN as string | undefined)?.trim();
	return (configured || pageOrigin).replace(/\/$/, '');
}

export function buildCanonicalUrl(origin: string, pathname: string): string {
	return `${origin.replace(/\/$/, '')}${pathname}`;
}

export interface OrganizationWebSiteGraphParams {
	originUrl: string;
	logoUrl: string;
}

/** JSON-LD graph with Organization and WebSite entities. */
export function buildOrganizationWebSiteGraph({
	originUrl,
	logoUrl
}: OrganizationWebSiteGraphParams): Record<string, unknown>[] {
	return [
		{
			'@type': 'Organization',
			'@id': `${originUrl}#organization`,
			name: SITE_NAME,
			url: originUrl,
			logo: logoUrl
		},
		{
			'@type': 'WebSite',
			'@id': `${originUrl}#website`,
			url: originUrl,
			name: SITE_NAME,
			publisher: { '@id': `${originUrl}#organization` }
		}
	];
}

export interface WebPageGraphParams {
	originUrl: string;
	pageUrl: string;
	pageName: string;
	pageDescription: string;
	logoUrl: string;
}

/** JSON-LD graph for a public page (Organization + WebSite + WebPage). */
export function buildWebPageGraph({
	originUrl,
	pageUrl,
	pageName,
	pageDescription,
	logoUrl
}: WebPageGraphParams): Record<string, unknown>[] {
	return [
		...buildOrganizationWebSiteGraph({ originUrl, logoUrl }),
		{
			'@type': 'WebPage',
			'@id': `${pageUrl}#webpage`,
			url: pageUrl,
			name: pageName,
			description: pageDescription,
			isPartOf: { '@id': `${originUrl}#website` }
		}
	];
}

export function wrapJsonLdGraph(graph: Record<string, unknown>[]): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@graph': graph
	};
}
