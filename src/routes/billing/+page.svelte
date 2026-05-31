<script lang="ts">
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient, HttpError } from '$lib/api/client';
	import { buildLoginRedirect } from '$lib/utils/navigation';
	import { consumePendingBillingPlan } from '$lib/utils/billing-selection';
	import BillingSection from '$lib/components/billing/BillingSection.svelte';
	import AccessCodeSection from '$lib/components/billing/AccessCodeSection.svelte';

	let guestMode = $derived(!$isAuthenticated);
	let subscriptionActive = $state(false);
	let subscriptionNotice = $state('');
	let subscriptionNoticeVariant = $state<'success' | 'error' | null>(null);
	let billingCompleteStarted = false;
	let autoCheckoutProductId = $state<string | null>(null);
	let canonicalUrl = $derived($page.url.origin + $page.url.pathname);
	let originUrl = $derived($page.url.origin + '/');
	let orgLogoUrl = $derived($page.url.origin + asset('/images/flit_app_logo.svg'));
	let jsonLdString = $derived.by(() =>
		JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'Organization',
					'@id': `${originUrl}#organization`,
					name: 'Flit',
					url: originUrl,
					logo: orgLogoUrl
				},
				{
					'@type': 'WebPage',
					'@id': `${canonicalUrl}#webpage`,
					url: canonicalUrl,
					name: 'Billing - Flit Web',
					description:
						'View Flit Web subscription plans, manage billing, and activate access codes.',
					isPartOf: {
						'@type': 'WebSite',
						'@id': `${originUrl}#website`,
						url: originUrl,
						name: 'Flit Web'
					}
				}
			]
		}).replace(/</g, '\\u003c')
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

<svelte:head>
	<title>Billing - Flit Web</title>
	<meta
		name="description"
		content="View Flit Web subscription plans, manage billing, and activate access codes."
	/>
	<!-- eslint-disable-next-line svelte/no-at-html-tags, @typescript-eslint/no-unused-expressions -->
	{@html '<script type="application/ld+json">' + jsonLdString + '</script>'}
</svelte:head>

<h1>Billing</h1>

{#if subscriptionNotice && subscriptionNoticeVariant}
	<div class="alert alert--{subscriptionNoticeVariant}" role="alert">
		<p class="alert__message">{subscriptionNotice}</p>
	</div>
{/if}

<div class="profile-stack">
	<BillingSection {guestMode} {autoCheckoutProductId} bind:subscriptionActive />
	{#if !guestMode && !subscriptionActive}
		<AccessCodeSection />
	{/if}
</div>
