import type { PlanDetailResponse, PlanPrice } from '$lib/types/billing';

export function isMonthlyPlan(plan: PlanDetailResponse): boolean {
	return typeof plan.plan_type === 'string' && plan.plan_type.startsWith('monthly');
}

export function isAnnualPlan(plan: PlanDetailResponse): boolean {
	return typeof plan.plan_type === 'string' && plan.plan_type.startsWith('annual');
}

export function sortSubscriptionPlans(plans: PlanDetailResponse[]): PlanDetailResponse[] {
	return [...plans].sort((a, b) => {
		if (isMonthlyPlan(a) && !isMonthlyPlan(b)) return -1;
		if (!isMonthlyPlan(a) && isMonthlyPlan(b)) return 1;
		if (isAnnualPlan(a) && !isAnnualPlan(b)) return -1;
		if (!isAnnualPlan(a) && isAnnualPlan(b)) return 1;
		return 0;
	});
}

export function formatPlanPrice(price: PlanPrice): string {
	const amount = (price.price / 100).toFixed(2);
	const symbol = price.currency === 'USD' ? '$' : `${price.currency} `;
	const count = price.payment_frequency_count ?? 1;
	const interval = (price.payment_frequency_interval ?? 'Month').toLowerCase();
	const intervalLabel = count === 1 ? interval : `${count} ${interval}s`;
	return `${symbol}${amount}/${intervalLabel}`;
}
