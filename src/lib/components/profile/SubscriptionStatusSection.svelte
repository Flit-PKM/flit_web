<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { currentUser } from '$lib/stores/auth';
	import { apiClient } from '$lib/api/client';
	import { captureApiError, errorLogger } from '$lib/utils/error-handler';
	import { formatProfileDate } from '$lib/utils/profile';
	import {
		formatSubscriptionStatus,
		getPortalErrorMessage,
		isActiveSubscriptionStatus,
		isPaymentIssueSubscriptionStatus,
		isPortalManageableStatus,
		redirectToCustomerPortal,
		resolveSubscriptionPlanName
	} from '$lib/utils/billing';
	import type { PlanDetailResponse } from '$lib/types/billing';

	let plans = $state<PlanDetailResponse[]>([]);
	let plansError = $state('');
	let portalLoading = $state(false);
	let portalError = $state('');

	const subscriptionStatus = $derived($currentUser?.subscription?.status ?? null);
	const subscriptionPeriodEnd = $derived($currentUser?.subscription?.current_period_end ?? null);
	const productId = $derived($currentUser?.subscription?.product_id ?? null);
	const accessGrant = $derived($currentUser?.access_grant ?? null);

	const hasPaidSubscription = $derived(subscriptionStatus !== null);
	const hasActiveSubscription = $derived(isActiveSubscriptionStatus(subscriptionStatus));
	const hasPaymentIssue = $derived(isPaymentIssueSubscriptionStatus(subscriptionStatus));
	const canManageViaPortal = $derived(isPortalManageableStatus(subscriptionStatus));
	const hasAccessGrantOnly = $derived(!hasPaidSubscription && accessGrant !== null);

	const formattedStatus = $derived(
		hasAccessGrantOnly
			? { label: 'Access code', badgeVariant: 'positive' as const }
			: formatSubscriptionStatus(subscriptionStatus)
	);

	const planName = $derived(resolveSubscriptionPlanName(productId, plans));

	const portalButtonLabel = $derived(
		subscriptionStatus === 'on_hold' ? 'Update payment method' : 'Manage subscription'
	);

	onMount(async () => {
		if (!productId) return;
		try {
			plans = await apiClient.getBillingPlans();
		} catch (err) {
			plansError = captureApiError(err, {
				component: 'SubscriptionStatusSection',
				operation: 'loadBillingPlans'
			});
		}
	});

	async function handleOpenPortal() {
		if (!canManageViaPortal) return;
		portalError = '';
		portalLoading = true;
		try {
			errorLogger.logDebug('Opening customer portal from profile');
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
</script>

<div>
	<span class="card__label--muted"> Subscription Status </span>
	<div class="card__row flex-start">
		<span
			class="badge badge--{formattedStatus.badgeVariant}"
			role="status"
			aria-label="Subscription status"
		>
			{formattedStatus.label}
		</span>
		{#if canManageViaPortal}
			<button
				type="button"
				class="btn btn--compact"
				onclick={handleOpenPortal}
				disabled={portalLoading}
			>
				{portalLoading ? 'Opening portal…' : portalButtonLabel}
			</button>
		{:else}
			<a href={resolve('/billing')} class="btn btn--compact">Manage billing</a>
		{/if}
	</div>
	{#if portalError}
		<p class="form-group__error mt-xs" role="alert">{portalError}</p>
	{/if}
	{#if hasActiveSubscription}
		{#if planName}
			<p class="card__meta">Plan: {planName}</p>
		{:else if productId && plansError}
			<p class="card__meta">Plan details unavailable.</p>
		{/if}
		{#if subscriptionPeriodEnd}
			<p class="card__meta">Next billing date: {formatProfileDate(subscriptionPeriodEnd)}</p>
		{/if}
	{:else if subscriptionStatus === 'pending'}
		<p class="card__meta">Pending activation.</p>
	{:else if hasPaymentIssue}
		<p class="card__meta">
			Payment issue — update your payment method or resubscribe on the billing page.
		</p>
	{:else if hasPaidSubscription}
		<p class="card__meta">Choose a plan on the billing page to resubscribe.</p>
	{:else if hasAccessGrantOnly && accessGrant}
		<p class="card__meta">Access active until {formatProfileDate(accessGrant.expires_at)}</p>
		<p class="card__meta">
			Includes encryption: {accessGrant.includes_encryption ? 'Yes' : 'No'}
		</p>
	{:else}
		<p class="card__meta">Upgrade to a paid plan on the billing page.</p>
	{/if}
</div>
