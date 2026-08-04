import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import {
	buildLoginRedirect,
	getProtectedRouteRedirect,
	parsePostLoginRedirect,
	parseRootRedirectTarget,
	resolvePostLoginDestination
} from './navigation';

describe('parsePostLoginRedirect', () => {
	it('allows whitelisted paths', () => {
		expect(parsePostLoginRedirect('/profile')).toBe('/profile');
	});

	it('allows billing callback path with query params', () => {
		const redirect = parsePostLoginRedirect('/?subscription_id=sub_1&status=active');
		expect(redirect).toBe('/?subscription_id=sub_1&status=active');
	});

	it('allows billing page callback with query params', () => {
		const redirect = parsePostLoginRedirect('/billing?subscription_id=sub_1&status=active');
		expect(redirect).toBe('/billing?subscription_id=sub_1&status=active');
	});

	it('allows /billing as redirect target', () => {
		expect(parsePostLoginRedirect('/billing')).toBe('/billing');
	});

	it('rejects external redirects', () => {
		expect(parsePostLoginRedirect('https://evil.example')).toBe('/notes');
	});
});

describe('buildLoginRedirect', () => {
	it('encodes return path for login redirect', () => {
		expect(buildLoginRedirect('/?subscription_id=sub_1&status=active')).toBe(
			'/login?redirect=%2F%3Fsubscription_id%3Dsub_1%26status%3Dactive'
		);
	});
});

describe('parseRootRedirectTarget', () => {
	it('returns notes for authenticated users', () => {
		expect(parseRootRedirectTarget(true, null)).toBe('/notes');
	});

	it('allows login/register redirect for guests', () => {
		expect(parseRootRedirectTarget(false, 'login')).toBe('/login');
		expect(parseRootRedirectTarget(false, 'register')).toBe('/register');
	});

	it('returns null for unsupported guest redirects', () => {
		expect(parseRootRedirectTarget(false, 'notes')).toBeNull();
		expect(parseRootRedirectTarget(false, null)).toBeNull();
	});
});

describe('resolvePostLoginDestination', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('prefers pending billing plan over redirect param', () => {
		sessionStorage.setItem('flit_pending_billing_plan', 'prod_x');
		expect(resolvePostLoginDestination('/profile')).toBe('/billing');
	});

	it('leaves pending plan for billing auto-checkout after routing', () => {
		sessionStorage.setItem('flit_pending_billing_plan', 'prod_x');
		expect(resolvePostLoginDestination('/profile')).toBe('/billing');
		expect(sessionStorage.getItem('flit_pending_billing_plan')).toBe('prod_x');
	});

	it('routes free plan to notes and consumes it', () => {
		sessionStorage.setItem('flit_pending_billing_plan', 'free');
		expect(resolvePostLoginDestination('/profile')).toBe('/notes');
		expect(sessionStorage.getItem('flit_pending_billing_plan')).toBeNull();
	});

	it('uses redirect when no pending plan', () => {
		expect(resolvePostLoginDestination('/profile')).toBe('/profile');
	});
});

describe('getProtectedRouteRedirect', () => {
	it('redirects guests to login', () => {
		expect(getProtectedRouteRedirect(false)).toBe('/login');
	});

	it('does not redirect authenticated users', () => {
		expect(getProtectedRouteRedirect(true)).toBeNull();
	});
});
