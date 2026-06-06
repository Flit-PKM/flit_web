<script lang="ts">
	import {
		CORE_PLAN_FEATURES,
		formatPlanPrice,
		getPlanDiscountNote,
		getPlanDisplaySubtitle,
		getPlanDisplayTitle,
		isAnnualPlan
	} from '$lib/utils/billing';
	import type { PlanDetailResponse } from '$lib/types/billing';

	interface Props {
		plan: PlanDetailResponse;
		variant?: 'subscribe' | 'manage';
		guestMode?: boolean;
		isCurrent?: boolean;
		loading?: boolean;
		loadingLabel?: string;
		disabled?: boolean;
		onclick?: () => void;
	}

	let {
		plan,
		variant = 'subscribe',
		guestMode = false,
		isCurrent = false,
		loading = false,
		loadingLabel = 'Redirecting…',
		disabled = false,
		onclick
	}: Props = $props();

	const isAnnual = $derived(isAnnualPlan(plan));
	const discountNote = $derived(getPlanDiscountNote(plan));
	const ctaLabel = $derived(
		variant === 'manage' ? 'Manage subscription' : guestMode ? 'Choose plan' : 'Subscribe'
	);
</script>

<button
	type="button"
	class="plan-card"
	class:plan-card--annual={isAnnual}
	class:plan-card--current={isCurrent}
	{disabled}
	{onclick}
	aria-current={isCurrent ? 'true' : undefined}
	aria-label="{getPlanDisplayTitle(plan)} plan – {variant === 'manage'
		? 'manage subscription'
		: guestMode
			? 'sign up'
			: 'go to checkout'}"
>
	{#if isAnnual}
		<span class="plan-card__promo">15% Discount</span>
	{/if}
	{#if isCurrent}
		<span class="plan-card__badge">Current plan</span>
	{/if}
	<div class="plan-card__main">
		<div class="plan-card__head">
			<div class="plan-card__title-group">
				<h3 class="plan-card__title">{getPlanDisplayTitle(plan)}</h3>
				<p class="plan-card__subtitle">{getPlanDisplaySubtitle(plan)}</p>
			</div>
			<p class="plan-card__price">{formatPlanPrice(plan.price)}</p>
		</div>
		<div class="plan-card__description">
			<p class="plan-card__tagline">Access to Flit Core features:</p>
			<ul class="plan-card__features">
				{#each CORE_PLAN_FEATURES as feature (feature)}
					<li>{feature}</li>
				{/each}
			</ul>
			{#if discountNote}
				<p class="plan-card__discount-note">{discountNote}</p>
			{/if}
		</div>
	</div>
	<span class="plan-card__cta">
		{#if loading}
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
				{loadingLabel}
			</span>
		{:else}
			{ctaLabel}
		{/if}
	</span>
</button>
