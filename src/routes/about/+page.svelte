<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/stores';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import {
		buildCanonicalUrl,
		buildWebPageGraph,
		getSiteOrigin,
		wrapJsonLdGraph
	} from '$lib/utils/seo';

	const aboutDescription =
		'Flit Web is a simple place for your notes — write, organize, and sync across devices.';

	let siteOrigin = $derived(getSiteOrigin($page.url.origin));
	let pageUrl = $derived(buildCanonicalUrl(siteOrigin, $page.url.pathname));
	let logoUrl = $derived(`${siteOrigin}${asset('/images/flit_app_logo.svg')}`);
	let jsonLd = $derived(
		wrapJsonLdGraph(
			buildWebPageGraph({
				originUrl: `${siteOrigin}/`,
				pageUrl,
				pageName: 'About - Flit Web',
				pageDescription: aboutDescription,
				logoUrl
			})
		)
	);
</script>

<SeoHead title="About - Flit Web" description={aboutDescription} />
<JsonLd data={jsonLd} />

<h1>About Flit</h1>
<div class="prose">
	<p class="card__meta">Simple notes. Effective when you need them. Yours.</p>
	<section>
		<h2>What is Flit?</h2>
		<p>
			Flit is a private place for your notes. Write them down, organize them, and find them later
			— without extra tools getting in the way.
		</p>
	</section>

	<section>
		<h2>Why Flit</h2>
		<p>
			Your notes should be easy to keep and fully under your control. Flit is built to stay useful:
			capture, organize, and sync — privately.
		</p>
		<ul class="card__meta">
			<li>Flit Web — Notes in the browser.</li>
			<li>Flit-App — Capture notes and ideas on the go.</li>
			<li>
				Still — Meditation timer and journaling to track sessions, set intentions, and reflect.
			</li>
		</ul>
	</section>

	<section>
		<h2>What you get</h2>
		<ul class="card__meta">
			<li><span>Notes, categories, and links</span></li>
			<li><span>Markdown import and export</span></li>
			<li><span>Sync and backup on Flit Core</span></li>
			<li><span>MCP access and connected apps</span></li>
			<li><span>Encryption in transit and at rest</span></li>
		</ul>
	</section>

	<section>
		<h2>Contact</h2>
		<p>
			Questions or feedback?<br />
			Visit
			<a href="https://bmd-studios.com" target="_blank" rel="noopener noreferrer">BMD-Studios</a>
			or email admin @ bmd-studios . com
		</p>
	</section>
	<hr />
	<div>
		<a href={resolve('/')} class="link">← Back to home</a>
	</div>
</div>
