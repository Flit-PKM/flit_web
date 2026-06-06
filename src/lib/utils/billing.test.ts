import { describe, expect, it } from 'vitest';
import type { PlanDetailResponse } from '$lib/types/billing';
import {
	formatSubscriptionStatus,
	isActiveSubscriptionStatus,
	isCancelledOrExpiredStatus,
	isPaymentIssueSubscriptionStatus,
	isPortalManageableStatus,
	resolveSubscriptionPlanName,
	sortSubscriptionPlans
} from './billing';

describe('isActiveSubscriptionStatus', () => {
	it('treats active as active', () => {
		expect(isActiveSubscriptionStatus('active')).toBe(true);
	});

	it('treats other statuses as inactive', () => {
		expect(isActiveSubscriptionStatus('pending')).toBe(false);
		expect(isActiveSubscriptionStatus('on_hold')).toBe(false);
		expect(isActiveSubscriptionStatus('cancelled')).toBe(false);
		expect(isActiveSubscriptionStatus(null)).toBe(false);
	});
});

describe('isPaymentIssueSubscriptionStatus', () => {
	it('detects payment issue statuses', () => {
		expect(isPaymentIssueSubscriptionStatus('on_hold')).toBe(true);
		expect(isPaymentIssueSubscriptionStatus('failed')).toBe(true);
	});

	it('returns false for other statuses', () => {
		expect(isPaymentIssueSubscriptionStatus('past_due')).toBe(false);
		expect(isPaymentIssueSubscriptionStatus('active')).toBe(false);
		expect(isPaymentIssueSubscriptionStatus(null)).toBe(false);
	});
});

describe('isPortalManageableStatus', () => {
	it('allows portal for active and on_hold', () => {
		expect(isPortalManageableStatus('active')).toBe(true);
		expect(isPortalManageableStatus('on_hold')).toBe(true);
	});

	it('disallows portal for other statuses', () => {
		expect(isPortalManageableStatus('cancelled')).toBe(false);
		expect(isPortalManageableStatus('failed')).toBe(false);
		expect(isPortalManageableStatus(null)).toBe(false);
	});
});

describe('isCancelledOrExpiredStatus', () => {
	it('detects cancelled and expired statuses', () => {
		expect(isCancelledOrExpiredStatus('cancelled')).toBe(true);
		expect(isCancelledOrExpiredStatus('canceled')).toBe(true);
		expect(isCancelledOrExpiredStatus('expired')).toBe(true);
	});

	it('returns false for other statuses', () => {
		expect(isCancelledOrExpiredStatus('active')).toBe(false);
		expect(isCancelledOrExpiredStatus(null)).toBe(false);
	});
});

describe('formatSubscriptionStatus', () => {
	it('maps known statuses to labels and badge variants', () => {
		expect(formatSubscriptionStatus('active')).toEqual({
			label: 'Active',
			badgeVariant: 'positive'
		});
		expect(formatSubscriptionStatus('pending')).toEqual({
			label: 'Pending',
			badgeVariant: 'muted'
		});
		expect(formatSubscriptionStatus('on_hold')).toEqual({
			label: 'Payment issue',
			badgeVariant: 'negative'
		});
		expect(formatSubscriptionStatus('cancelled')).toEqual({
			label: 'Cancelled',
			badgeVariant: 'negative'
		});
	});

	it('returns Free for missing subscription status', () => {
		expect(formatSubscriptionStatus(null)).toEqual({
			label: 'Free',
			badgeVariant: 'muted'
		});
	});
});

describe('sortSubscriptionPlans', () => {
	it('orders annual before monthly for center-column layout', () => {
		const monthly: PlanDetailResponse = {
			product_id: 'prod_monthly',
			name: 'Monthly',
			is_recurring: true,
			plan_type: 'monthly',
			price: { currency: 'USD', price: 599 }
		};
		const annual: PlanDetailResponse = {
			product_id: 'prod_annual',
			name: 'Annual',
			is_recurring: true,
			plan_type: 'annual',
			price: { currency: 'USD', price: 17999 }
		};

		expect(sortSubscriptionPlans([monthly, annual]).map((p) => p.product_id)).toEqual([
			'prod_annual',
			'prod_monthly'
		]);
	});
});

describe('resolveSubscriptionPlanName', () => {
	const plans: PlanDetailResponse[] = [
		{
			product_id: 'prod_monthly',
			name: 'Monthly Core AI',
			is_recurring: true,
			price: { currency: 'USD', price: 999 }
		}
	];

	it('returns the matching plan name', () => {
		expect(resolveSubscriptionPlanName('prod_monthly', plans)).toBe('Monthly Core AI');
	});

	it('returns null when product id is missing or unknown', () => {
		expect(resolveSubscriptionPlanName(null, plans)).toBeNull();
		expect(resolveSubscriptionPlanName('prod_unknown', plans)).toBeNull();
	});
});
