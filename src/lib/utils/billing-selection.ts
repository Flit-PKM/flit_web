import { browser } from '$app/environment';

const STORAGE_KEY = 'flit_pending_billing_plan';

export type PendingBillingPlan = 'free' | string;

export function setPendingBillingPlan(plan: PendingBillingPlan): void {
	if (!browser) return;
	sessionStorage.setItem(STORAGE_KEY, plan);
}

export function peekPendingBillingPlan(): PendingBillingPlan | null {
	if (!browser) return null;
	const value = sessionStorage.getItem(STORAGE_KEY);
	return value ? (value as PendingBillingPlan) : null;
}

export function consumePendingBillingPlan(): PendingBillingPlan | null {
	if (!browser) return null;
	const value = peekPendingBillingPlan();
	if (!value) return null;
	sessionStorage.removeItem(STORAGE_KEY);
	return value;
}

/** Post-login/register destination when a billing plan was chosen before signup. */
export function resolvePostAuthBillingDestination(plan: PendingBillingPlan | null): string {
	if (!plan) return '/notes';
	if (plan === 'free') return '/notes';
	return '/billing';
}
