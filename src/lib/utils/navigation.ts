import {
	consumePendingBillingPlan,
	peekPendingBillingPlan,
	resolvePostAuthBillingDestination
} from './billing-selection';

const DEFAULT_AUTH_REDIRECT = '/notes';

const SAFE_REDIRECT_PATHS = new Set(['/profile', '/notes', '/', '/about', '/terms', '/billing']);

export function parsePostLoginRedirect(rawRedirect: string | null): string {
	if (!rawRedirect) return DEFAULT_AUTH_REDIRECT;
	if (!rawRedirect.startsWith('/')) return DEFAULT_AUTH_REDIRECT;

	try {
		const parsed = new URL(rawRedirect, 'http://local.flit');
		const pathWithQuery = `${parsed.pathname}${parsed.search}`;

		// Allow known top-level destinations.
		if (SAFE_REDIRECT_PATHS.has(parsed.pathname)) {
			return pathWithQuery;
		}

		// Allow billing callback route with query params from checkout return.
		if (
			(parsed.pathname === '/' || parsed.pathname === '/billing') &&
			parsed.searchParams.has('subscription_id')
		) {
			return pathWithQuery;
		}
	} catch {
		return DEFAULT_AUTH_REDIRECT;
	}

	return DEFAULT_AUTH_REDIRECT;
}

/**
 * After login/register: pending billing plan wins, else safe ?redirect= path.
 * Paid plans are peeked only (billing page consumes for auto-checkout).
 * Free plans are consumed here so they do not stick across later logins.
 */
export function resolvePostLoginDestination(requestedRedirect: string | null): string {
	const pending = peekPendingBillingPlan();
	if (pending) {
		if (pending === 'free') {
			consumePendingBillingPlan();
		}
		return resolvePostAuthBillingDestination(pending);
	}
	return parsePostLoginRedirect(requestedRedirect);
}

export function buildLoginRedirect(returnPath: string): string {
	return `/login?redirect=${encodeURIComponent(returnPath)}`;
}

export function parseRootRedirectTarget(
	isAuthenticated: boolean,
	redirectParam: string | null
): string | null {
	if (isAuthenticated) return '/notes';
	const target = redirectParam?.toLowerCase();
	if (target === 'login') return '/login';
	if (target === 'register') return '/register';
	return null;
}

export function getProtectedRouteRedirect(isAuthenticated: boolean): string | null {
	return isAuthenticated ? null : '/login';
}
