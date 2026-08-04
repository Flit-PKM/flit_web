<script lang="ts">
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient, HttpError } from '$lib/api/client';
	import { buildLoginRedirect } from '$lib/utils/navigation';
	import { consumePendingBillingPlan } from '$lib/utils/billing-selection';
	import { CORE_PLAN_FEATURES } from '$lib/utils/billing';
	import BillingSection from '$lib/components/billing/BillingSection.svelte';
	import AccessCodeSection from '$lib/components/billing/AccessCodeSection.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import {
		buildCanonicalUrl,
		buildWebPageGraph,
		getSiteOrigin,
		wrapJsonLdGraph
	} from '$lib/utils/seo';

	const billingDescription =
		'View Flit Web subscription plans, manage billing, and activate access codes.';

	let guestMode = $derived(!$isAuthenticated);
	let subscriptionActive = $state(false);
	let subscriptionNotice = $state('');
	let subscriptionNoticeVariant = $state<'success' | 'error' | null>(null);
	let billingCompleteStarted = false;
	let autoCheckoutProductId = $state<string | null>(null);

	let siteOrigin = $derived(getSiteOrigin($page.url.origin));
	let pageUrl = $derived(buildCanonicalUrl(siteOrigin, $page.url.pathname));
	let logoUrl = $derived(`${siteOrigin}${asset('/images/flit_app_logo.svg')}`);
	let jsonLd = $derived(
		wrapJsonLdGraph(
			buildWebPageGraph({
				originUrl: `${siteOrigin}/`,
				pageUrl,
				pageName: 'Billing - Flit Web',
				pageDescription: billingDescription,
				logoUrl
			})
		)
	);

	$effect(() => {
		const notice = $page.url.searchParams.get('subscription');
		if (notice === 'success') {
			subscriptionNoticeVariant = 'success';
			subscriptionNotice = 'Subscription activated successfully.';
		} else if (notice === 'error') {
			subscriptionNoticeVariant = 'error';
			subscriptionNotice =
				'We could not confirm your subscription. Please try again or contact support.';
		} else {
			subscriptionNoticeVariant = null;
			subscriptionNotice = '';
		}
	});

	$effect(() => {
		const params = $page.url.searchParams;
		const subscriptionId = params.get('subscription_id');
		const status = params.get('status');
		const hasBillingParams = Boolean(subscriptionId && status);

		if (hasBillingParams && !$isAuthenticated) {
			const returnPath = $page.url.pathname + $page.url.search;
			goto(buildLoginRedirect(returnPath) as Parameters<typeof goto>[0]);
			return;
		}

		if (hasBillingParams && $isAuthenticated && !billingCompleteStarted) {
			billingCompleteStarted = true;
			const returnPath = $page.url.pathname + $page.url.search;
			(async () => {
				try {
					await apiClient.postBillingComplete({
						subscription_id: subscriptionId!,
						status: status!
					});
					goto(resolve('/billing') + '?subscription=success');
				} catch (err) {
					if (err instanceof HttpError && err.status === 401) {
						goto(buildLoginRedirect(returnPath) as Parameters<typeof goto>[0]);
					} else {
						goto(resolve('/billing') + '?subscription=error');
					}
				}
			})();
		}
	});

	let pendingCheckoutHandled = $state(false);

	$effect(() => {
		if (!$isAuthenticated) {
			autoCheckoutProductId = null;
			pendingCheckoutHandled = false;
			return;
		}
		if (pendingCheckoutHandled) return;
		const pending = consumePendingBillingPlan();
		if (pending && pending !== 'free') {
			autoCheckoutProductId = pending;
			pendingCheckoutHandled = true;
		}
	});
</script>

<SeoHead title="Billing - Flit Web" description={billingDescription} />
<JsonLd data={jsonLd} />

<h1>Billing</h1>

{#if subscriptionNotice && subscriptionNoticeVariant}
	<div class="alert alert--{subscriptionNoticeVariant}" role="alert">
		<p class="alert__message">{subscriptionNotice}</p>
	</div>
{/if}

<section class="card prose" aria-label="Subscription plans overview">
	<h2 class="section-title">Subscription plans</h2>
	<p>
		Flit Web offers a free tier and paid Flit Core plans billed monthly or annually. Paid plans
		include the features below; live prices appear in the plan selector once loaded.
	</p>
	<ul>
		<li>
			<strong>Free</strong> — use Flit Web at no cost. Create notes, link ideas, and organize your knowledge.
			Upgrade anytime for AI and encryption features.
		</li>
		<li>
			<strong>Monthly</strong> — Flit Core billed every month with full access to paid features.
		</li>
		<li>
			<strong>Annual</strong> — Flit Core billed yearly with a 15% discount compared to paying monthly.
		</li>
	</ul>
	<p class="card__meta">Flit Core paid plan features:</p>
	<ul class="card__meta">
		{#each CORE_PLAN_FEATURES as feature (feature)}
			<li>{feature}</li>
		{/each}
	</ul>
</section>

<div class="profile-stack">
	<BillingSection {guestMode} {autoCheckoutProductId} bind:subscriptionActive />
	{#if !guestMode && !subscriptionActive}
		<AccessCodeSection />
	{/if}
</div>
