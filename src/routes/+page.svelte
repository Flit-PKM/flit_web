<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve, asset } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated, currentUser } from '$lib/stores/auth';
	import { parseRootRedirectTarget, resolvePostLoginDestination } from '$lib/utils/navigation';
	import AuthCredentialsForm from '$lib/components/AuthCredentialsForm.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import {
		buildCanonicalUrl,
		buildWebPageGraph,
		getSiteOrigin,
		wrapJsonLdGraph
	} from '$lib/utils/seo';

	const homeDescription =
		'Simple notes that stay useful. Write, organize, and sync across devices.';

	let siteOrigin = $derived(getSiteOrigin($page.url.origin));
	let pageUrl = $derived(buildCanonicalUrl(siteOrigin, $page.url.pathname));
	let logoUrl = $derived(`${siteOrigin}${asset('/images/flit_app_logo.svg')}`);
	let jsonLd = $derived(
		wrapJsonLdGraph(
			buildWebPageGraph({
				originUrl: `${siteOrigin}/`,
				pageUrl,
				pageName: 'Flit Web – Welcome',
				pageDescription: homeDescription,
				logoUrl
			})
		)
	);

	// Billing checkout may still return to /; forward to /billing handler.
	$effect(() => {
		const params = $page.url.searchParams;
		const subscriptionId = params.get('subscription_id');
		const status = params.get('status');
		const hasBillingParams = Boolean(subscriptionId && status);

		if (hasBillingParams) {
			goto((resolve('/billing') + $page.url.search) as Parameters<typeof goto>[0]);
			return;
		}

		if ($isAuthenticated) {
			goto(resolvePostLoginDestination(null) as Parameters<typeof goto>[0]);
			return;
		}

		const target = parseRootRedirectTarget(false, params.get('redirect'));
		if (target) goto(target as Parameters<typeof goto>[0]);
	});
</script>

<SeoHead title="Flit Web – Welcome" description={homeDescription} />
<JsonLd data={jsonLd} />

<header class="hero">
	<h1>Flit</h1>
	<p class="card__meta">Simple notes. Effective when you need them.</p>
	<p>
		A place for your notes — write, organize, and find them later. Sync when you want a backup.
	</p>
</header>

<div>
	<div class="card small">
		{#if $isAuthenticated && $currentUser}
			<div class="landing__stack">
				<h3>Welcome back, {$currentUser.email}</h3>
				<p class="card__meta">You’re signed in.</p>
				<a href={resolve('/profile')} class="btn btn-primary">View Profile</a>
			</div>
		{:else}
			<div class="landing__stack">
				<h3>Get started</h3>
				<p class="card__meta">Create an account or sign in to use your notes.</p>
				<AuthCredentialsForm />
			</div>
		{/if}
	</div>

	<div class="landing__highlights">
		<article class="landing__tile">
			<h3>Notes that stay out of the way</h3>
			<p>
				Write, edit, and keep going. Markdown, categories, and links — without extra ceremony.
			</p>
		</article>

		<article class="landing__tile">
			<h3>Yours</h3>
			<p>Your account, your notes. Encryption in transit and at rest.</p>
		</article>

		<article class="landing__tile">
			<h3>Take them with you</h3>
			<p>Import and export Markdown. Sync across devices on Flit Core, including MCP access.</p>
		</article>
	</div>
</div>
