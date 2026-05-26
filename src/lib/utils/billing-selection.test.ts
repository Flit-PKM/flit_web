import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import {
	consumePendingBillingPlan,
	resolvePostAuthBillingDestination,
	setPendingBillingPlan
} from './billing-selection';

describe('billing-selection', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('stores and consumes pending plan', () => {
		setPendingBillingPlan('prod_123');
		expect(consumePendingBillingPlan()).toBe('prod_123');
		expect(consumePendingBillingPlan()).toBeNull();
	});

	it('resolves free to notes and paid to billing', () => {
		expect(resolvePostAuthBillingDestination('free')).toBe('/notes');
		expect(resolvePostAuthBillingDestination('prod_abc')).toBe('/billing');
		expect(resolvePostAuthBillingDestination(null)).toBe('/notes');
	});
});
