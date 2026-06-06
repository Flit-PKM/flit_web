<script lang="ts">
	import { page } from '$app/stores';
	import { asset } from '$app/paths';
	import {
		DEFAULT_DESCRIPTION,
		NOINDEX_ROBOTS,
		OG_IMAGE_PATH,
		SITE_NAME,
		buildCanonicalUrl,
		getSiteOrigin
	} from '$lib/utils/seo';

	interface Props {
		title: string;
		description?: string;
		noindex?: boolean;
	}

	let { title, description = DEFAULT_DESCRIPTION, noindex = false }: Props = $props();

	let siteOrigin = $derived(getSiteOrigin($page.url.origin));
	let pageUrl = $derived(buildCanonicalUrl(siteOrigin, $page.url.pathname));
	let ogImageUrl = $derived(`${siteOrigin}${asset(OG_IMAGE_PATH)}`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	{#if noindex}
		<meta name="robots" content={NOINDEX_ROBOTS} />
	{/if}

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:image" content={ogImageUrl} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>
