/**
 * Billing API types
 *
 * Types for the /billing endpoints (Dodo Payments checkout).
 * Backend creates sessions server-side and returns redirect URLs.
 */

/**
 * Request body for POST /billing/checkout (CheckoutCreate).
 * Optional return URL after checkout.
 */
export interface CheckoutSessionRequest {
	return_url?: string | null;
}

/**
 * Response from POST /billing/checkout (CheckoutResponse).
 * Contains the session id and URL to redirect the user to for checkout.
 */
export interface CheckoutSessionResponse {
	session_id: string;
	checkout_url: string;
}

/**
 * Response from GET /billing/subscription (SubscriptionStatusResponse).
 * All fields are null when the user has no subscription.
 */
export interface SubscriptionStatusResponse {
	status: string | null;
	current_period_end: string | null;
	dodo_subscription_id: string | null;
}
