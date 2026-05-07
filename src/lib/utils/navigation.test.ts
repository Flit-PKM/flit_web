import { describe, expect, it } from 'vitest';
import {
	buildLoginRedirect,
	getProtectedRouteRedirect,
	parsePostLoginRedirect,
	parseRootRedirectTarget
} from './navigation';

describe('parsePostLoginRedirect', () => {
	it('allows whitelisted paths', () => {
		expect(parsePostLoginRedirect('/profile')).toBe('/profile');
	});

	it('allows billing callback path with query params', () => {
		const redirect = parsePostLoginRedirect('/?subscription_id=sub_1&status=active');
		expect(redirect).toBe('/?subscription_id=sub_1&status=active');
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

describe('getProtectedRouteRedirect', () => {
	it('redirects guests to login', () => {
		expect(getProtectedRouteRedirect(false)).toBe('/login');
	});

	it('does not redirect authenticated users', () => {
		expect(getProtectedRouteRedirect(true)).toBeNull();
	});
});
