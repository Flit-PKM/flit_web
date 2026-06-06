import { apiClient } from '$lib/api/client';
import type { PlanDetailResponse, PlanPrice } from '$lib/types/billing';
import { getCheckoutErrorMessage } from '$lib/utils/profile';

export type SubscriptionBadgeVariant = 'positive' | 'negative' | 'muted';

export interface FormattedSubscriptionStatus {
	label: string;
	badgeVariant: SubscriptionBadgeVariant;
}

const PAYMENT_ISSUE_STATUSES = new Set(['on_hold', 'failed']);
const CANCELLED_OR_EXPIRED_STATUSES = new Set(['cancelled', 'canceled', 'expired']);

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
	return status === 'active';
}

export function isPaymentIssueSubscriptionStatus(status: string | null | undefined): boolean {
	return typeof status === 'string' && PAYMENT_ISSUE_STATUSES.has(status);
}

export function isPortalManageableStatus(status: string | null | undefined): boolean {
	return status === 'active' || status === 'on_hold';
}

export function isCancelledOrExpiredStatus(status: string | null | undefined): boolean {
	return typeof status === 'string' && CANCELLED_OR_EXPIRED_STATUSES.has(status);
}

function humanizeSubscriptionStatus(status: string): string {
	return status
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function formatSubscriptionStatus(
	status: string | null | undefined
): FormattedSubscriptionStatus {
	if (status === 'active') {
		return { label: 'Active', badgeVariant: 'positive' };
	}
	if (status === 'pending') {
		return { label: 'Pending', badgeVariant: 'muted' };
	}
	if (isPaymentIssueSubscriptionStatus(status)) {
		return { label: 'Payment issue', badgeVariant: 'negative' };
	}
	if (status) {
		const negativeStatuses = new Set(['canceled', 'cancelled', 'expired', 'unpaid']);
		return {
			label: humanizeSubscriptionStatus(status),
			badgeVariant: negativeStatuses.has(status) ? 'negative' : 'muted'
		};
	}
	return { label: 'Free', badgeVariant: 'muted' };
}

export async function redirectToCustomerPortal(): Promise<void> {
	const { portal_url } = await apiClient.getCustomerPortal();
	if (!portal_url) {
		throw new Error('Missing portal_url in response');
	}
	window.location.href = portal_url;
}

export function getPortalErrorMessage(err: unknown): string {
	return getCheckoutErrorMessage(err);
}

export function resolveSubscriptionPlanName(
	productId: string | null | undefined,
	plans: PlanDetailResponse[]
): string | null {
	if (!productId) return null;
	const plan = plans.find((entry) => entry.product_id === productId);
	return plan?.name ?? null;
}

export function isMonthlyPlan(plan: PlanDetailResponse): boolean {
	return typeof plan.plan_type === 'string' && plan.plan_type.startsWith('monthly');
}

export function isAnnualPlan(plan: PlanDetailResponse): boolean {
	return typeof plan.plan_type === 'string' && plan.plan_type.startsWith('annual');
}

/** Display order: annual (center column) before monthly (right column). */
export function sortSubscriptionPlans(plans: PlanDetailResponse[]): PlanDetailResponse[] {
	return [...plans].sort((a, b) => {
		if (isAnnualPlan(a) && !isAnnualPlan(b)) return -1;
		if (!isAnnualPlan(a) && isAnnualPlan(b)) return 1;
		if (isMonthlyPlan(a) && !isMonthlyPlan(b)) return -1;
		if (!isMonthlyPlan(a) && isMonthlyPlan(b)) return 1;
		return 0;
	});
}

export const CORE_PLAN_FEATURES = [
	'Multi-device sync & backup',
	'AI inference',
	'MCP access',
	'Rich markdown notes & categories',
	'Connected apps integration'
] as const;

export function getPlanDisplayTitle(plan: PlanDetailResponse): string {
	return isAnnualPlan(plan) ? 'Annual' : 'Monthly';
}

export function getPlanDisplaySubtitle(plan: PlanDetailResponse): string {
	return isAnnualPlan(plan) ? 'Flit Core — billed yearly' : 'Flit Core — billed monthly';
}

export function getPlanDiscountNote(plan: PlanDetailResponse): string | null {
	return isAnnualPlan(plan) ? 'Save 15% compared to paying monthly.' : null;
}

export function formatPlanPrice(price: PlanPrice): string {
	const amount = (price.price / 100).toFixed(2);
	const symbol = price.currency === 'USD' ? '$' : `${price.currency} `;
	const count = price.payment_frequency_count ?? 1;
	const interval = (price.payment_frequency_interval ?? 'Month').toLowerCase();
	const intervalLabel = count === 1 ? interval : `${count} ${interval}s`;
	return `${symbol}${amount}/${intervalLabel}`;
}
