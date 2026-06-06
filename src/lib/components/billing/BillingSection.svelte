<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base, resolve } from '$app/paths';
	import { authActions, currentUser } from '$lib/stores/auth';
	import { apiClient } from '$lib/api/client';
	import { captureApiError, errorLogger } from '$lib/utils/error-handler';
	import {
		getPortalErrorMessage,
		isActiveSubscriptionStatus,
		isAnnualPlan,
		isCancelledOrExpiredStatus,
		isMonthlyPlan,
		isPaymentIssueSubscriptionStatus,
		isPortalManageableStatus,
		redirectToCustomerPortal,
		sortSubscriptionPlans
	} from '$lib/utils/billing';
	import { formatProfileDate, getCheckoutErrorMessage } from '$lib/utils/profile';
	import { setPendingBillingPlan, type PendingBillingPlan } from '$lib/utils/billing-selection';
	import type { PlanDetailResponse, SubscriptionStatusResponse } from '$lib/types/billing';
	import FreePlanCard from './FreePlanCard.svelte';
	import PaidPlanCard from './PaidPlanCard.svelte';

	interface Props {
		guestMode?: boolean;
		autoCheckoutProductId?: string | null;
		subscriptionActive?: boolean;
	}

	let {
		guestMode = false,
		autoCheckoutProductId = null,
		subscriptionActive = $bindable(false)
	}: Props = $props();

	let checkoutLoading = $state(false);
	let checkoutError = $state('');
	let portalLoading = $state(false);
	let portalError = $state('');
	let subscriptionStatus = $state<SubscriptionStatusResponse | null>(null);
	let subscriptionLoading = $state(false);
	let subscriptionError = $state('');
	let plans = $state<PlanDetailResponse[]>([]);
	let plansLoading = $state(false);
	let plansError = $state('');

	let resolvedStatus = $derived(
		$currentUser?.subscription?.status ?? subscriptionStatus?.status ?? null
	);
	let hasActiveSubscription = $derived(isActiveSubscriptionStatus(resolvedStatus));
	let hasPaymentIssue = $derived(isPaymentIssueSubscriptionStatus(resolvedStatus));
	let canManageViaPortal = $derived(isPortalManageableStatus(resolvedStatus));
	let currentPlanProductId = $derived($currentUser?.subscription?.product_id ?? null);
	let currentPeriodEnd = $derived(
		$currentUser?.subscription?.current_period_end ?? subscriptionStatus?.current_period_end ?? null
	);

	let subscriptionPlans = $derived.by(() => {
		const list = plans.filter((p) => isMonthlyPlan(p) || isAnnualPlan(p));
		return sortSubscriptionPlans(list);
	});

	let showSubscriptionLoaded = $derived(!subscriptionLoading);
	let showActivePlan = $derived(!guestMode && showSubscriptionLoaded && !!hasActiveSubscription);
	let showPlansSection = $derived(showSubscriptionLoaded && !plansLoading && !plansError);
	let showPlansList = $derived(
		showPlansSection && (guestMode || (!guestMode && !hasActiveSubscription))
	);

	let showActiveSubscriptionOnly = $derived(
		!guestMode && hasActiveSubscription && showPlansSection
	);

	let currentPlan = $derived(
		currentPlanProductId
			? (subscriptionPlans.find((p) => p.product_id === currentPlanProductId) ?? null)
			: null
	);

	let isCurrentFreePlan = $derived(
		!guestMode && !hasActiveSubscription && !$currentUser?.access_grant
	);

	$effect(() => {
		subscriptionActive = hasActiveSubscription;
	});

	let autoCheckoutStarted = $state(false);

	onMount(() => {
		void loadPlans();
		if (!guestMode) {
			void (async () => {
				await loadSubscription();
				await authActions.refreshUser();
			})();
		}
	});

	$effect(() => {
		const productId = autoCheckoutProductId;
		if (guestMode || !productId || autoCheckoutStarted || checkoutLoading) return;
		autoCheckoutStarted = true;
		void handleCheckout(productId);
	});

	async function loadPlans() {
		plansLoading = true;
		plansError = '';
		try {
			plans = await apiClient.getBillingPlans();
		} catch (err) {
			plansError = captureApiError(err, {
				component: 'BillingSection',
				operation: 'loadBillingPlans'
			});
		} finally {
			plansLoading = false;
		}
	}

	async function loadSubscription() {
		subscriptionLoading = true;
		subscriptionError = '';
		try {
			subscriptionStatus = await apiClient.getSubscription();
		} catch (err) {
			subscriptionError = captureApiError(err, {
				component: 'BillingSection',
				operation: 'loadSubscription'
			});
		} finally {
			subscriptionLoading = false;
		}
	}

	async function retryLoadSubscription() {
		await loadSubscription();
	}

	async function retryLoadPlans() {
		await loadPlans();
	}

	function handleGuestPlanSelect(plan: PendingBillingPlan) {
		setPendingBillingPlan(plan);
		goto(resolve('/register'));
	}

	async function handleOpenPortal() {
		if (guestMode || !canManageViaPortal) return;
		portalError = '';
		portalLoading = true;
		try {
			errorLogger.logDebug('Opening customer portal');
			await redirectToCustomerPortal();
		} catch (err) {
			errorLogger.logError(err instanceof Error ? err : new Error(String(err)), {
				operation: 'getCustomerPortal'
			});
			portalError = getPortalErrorMessage(err);
		} finally {
			portalLoading = false;
		}
	}

	async function handleCheckout(productId: string) {
		if (!productId || guestMode) return;
		checkoutError = '';
		checkoutLoading = true;
		try {
			errorLogger.logDebug('Creating checkout session', { productId });
			const returnUrl =
				typeof window !== 'undefined' ? `${window.location.origin}${base}/billing` : undefined;
			const data = await apiClient.createCheckoutSession({
				product_id: productId,
				return_url: returnUrl ?? undefined
			});
			if (!data?.checkout_url) {
				errorLogger.logError(new Error('Missing checkout_url in response'), {
					operation: 'createCheckoutSession'
				});
				checkoutError = 'Checkout is temporarily unavailable. Please try again later.';
				return;
			}
			errorLogger.logDebug('Checkout session created, redirecting');
			window.location.href = data.checkout_url;
		} catch (err) {
			errorLogger.logError(err instanceof Error ? err : new Error(String(err)), {
				operation: 'createCheckoutSession'
			});
			checkoutError = getCheckoutErrorMessage(err);
		} finally {
			checkoutLoading = false;
		}
	}
</script>

<div class="card">
	<h2>Billing</h2>
	<p class="card__meta">
		{guestMode
			? 'Choose a plan, then create an account to get started.'
			: hasActiveSubscription
				? 'Your active subscription.'
				: 'Manage your subscription and payment.'}
	</p>

	{#if !guestMode && subscriptionLoading}
		<p class="card__meta">Loading subscription…</p>
	{:else if !guestMode && subscriptionError}
		<div class="alert alert--error" role="alert">
			<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
					clip-rule="evenodd"
				/>
			</svg>
			<p class="alert__message">{subscriptionError}</p>
			<button type="button" class="btn btn-secondary mt-sm" onclick={retryLoadSubscription}>
				Retry
			</button>
		</div>
	{/if}

	{#if showActivePlan && currentPeriodEnd}
		<p class="card__meta card__meta--mb-md">
			Next billing date: {formatProfileDate(currentPeriodEnd)}
		</p>
	{/if}

	{#if showSubscriptionLoaded}
		{#if checkoutError}
			<div class="alert alert--error" role="alert">
				<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="alert__message">{checkoutError}</p>
			</div>
		{/if}
		{#if portalError}
			<div class="alert alert--error" role="alert">
				<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="alert__message">{portalError}</p>
			</div>
		{/if}
		{#if !guestMode && !hasActiveSubscription && resolvedStatus !== null}
			{#if resolvedStatus === 'on_hold'}
				<p class="card__meta card__meta--mb-md">
					Payment issue — update your payment method or resubscribe below.
				</p>
				<div class="card__meta--mb-md">
					<button
						type="button"
						class="btn btn-primary"
						onclick={handleOpenPortal}
						disabled={portalLoading}
					>
						{#if portalLoading}
							<span class="loading__spinner loading__spinner--mr-sm" aria-hidden="true">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle
										class="loading__spinner-inner"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="loading__spinner-path"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
							</span>
							Opening customer portal…
						{:else}
							Update payment method
						{/if}
					</button>
				</div>
			{:else if isCancelledOrExpiredStatus(resolvedStatus)}
				<p class="card__meta card__meta--mb-md">
					Subscription cancelled or expired. Choose a plan to resubscribe.
				</p>
			{:else if hasPaymentIssue}
				<p class="card__meta card__meta--mb-md">
					Payment issue — update your payment method or resubscribe below.
				</p>
			{:else if resolvedStatus === 'pending'}
				<p class="card__meta card__meta--mb-md">Subscription pending activation.</p>
			{/if}
		{:else if !guestMode && !hasActiveSubscription}
			<p class="card__meta card__meta--mb-md">
				Upgrade or manage your subscription via secure checkout.
			</p>
		{/if}

		{#if plansLoading}
			<p class="card__meta">Loading plans…</p>
		{:else if plansError}
			<div class="alert alert--error" role="alert">
				<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="alert__message">{plansError}</p>
				<button type="button" class="btn btn-secondary mt-sm" onclick={retryLoadPlans}>Retry</button
				>
			</div>
		{:else if plans.length === 0 && !guestMode && !hasActiveSubscription}
			<p class="card__meta">No plans available at the moment.</p>
		{:else if showActiveSubscriptionOnly}
			<div class="grid-cards grid-cards--plans grid-cards--plans-single">
				{#if currentPlan}
					<PaidPlanCard
						plan={currentPlan}
						variant="manage"
						isCurrent
						loading={portalLoading}
						loadingLabel="Opening customer portal…"
						disabled={portalLoading}
						onclick={handleOpenPortal}
					/>
				{:else if currentPlanProductId}
					<button
						type="button"
						onclick={handleOpenPortal}
						disabled={portalLoading}
						class="plan-card plan-card--current"
						aria-current="true"
						aria-label="Manage active subscription"
					>
						<span class="plan-card__badge">Current plan</span>
						<div class="plan-card__main">
							<h3 class="plan-card__title">Active subscription</h3>
						</div>
						<span class="plan-card__cta">
							{#if portalLoading}
								<span class="plan-card__cta-loading">
									<span class="loading__spinner" aria-hidden="true">
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle
												class="loading__spinner-inner"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>
											<path
												class="loading__spinner-path"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
									</span>
									Opening customer portal…
								</span>
							{:else}
								Manage subscription
							{/if}
						</span>
					</button>
				{/if}
			</div>
		{:else if showPlansList}
			<div class="grid-cards grid-cards--plans">
				<FreePlanCard
					{guestMode}
					isCurrent={isCurrentFreePlan}
					hasActiveSubscription={false}
					onselect={() => handleGuestPlanSelect('free')}
				/>
				{#each subscriptionPlans as plan (plan.product_id)}
					<PaidPlanCard
						{plan}
						{guestMode}
						disabled={!guestMode && checkoutLoading}
						onclick={() =>
							guestMode ? handleGuestPlanSelect(plan.product_id) : handleCheckout(plan.product_id)}
					/>
				{/each}
			</div>
		{:else if guestMode && !plansLoading && !plansError}
			<div class="grid-cards grid-cards--plans">
				<FreePlanCard {guestMode} onselect={() => handleGuestPlanSelect('free')} />
			</div>
		{/if}
	{/if}
</div>
