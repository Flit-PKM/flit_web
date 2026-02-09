/**
 * Billing API types
 *
 * Types for the /billing endpoints (Dodo Payments checkout).
 * Backend creates sessions server-side and returns redirect URLs.
 */

/**
 * Price object from plan/product (cents, interval, optional discount/trial).
 */
export interface PlanPrice {
	type?: string;
	currency: string;
	price: number;
	payment_frequency_interval?: string;
	payment_frequency_count?: number;
	subscription_period_interval?: string;
	subscription_period_count?: number;
	discount?: number;
	trial_period_days?: number;
	[key: string]: unknown;
}

/**
 * Addon details from Dodo Payments for display.
 */
export interface AddonDetailResponse {
	id: string;
	name?: string | null;
	description?: string | null;
	image?: string | null;
	price?: number | null;
	currency?: string | null;
	tax_category?: string;
}

/**
 * Meter details from Dodo Payments (usage-based).
 */
export interface MeterDetailResponse {
	id: string;
	name?: string | null;
	description?: string | null;
	event_name?: string | null;
	aggregation?: Record<string, unknown>;
	measurement_unit?: string | null;
}

/**
 * Plan type enum from backend (GET /billing/plans). Used to partition Monthly vs Annual in UI.
 */
export type PlanTypeBackend =
	| 'monthly_core_ai'
	| 'monthly_core_ai_encryption'
	| 'annual_core_ai'
	| 'annual_core_ai_encryption';

/**
 * Plan/product details from GET /billing/plans.
 */
export interface PlanDetailResponse {
	product_id: string;
	name?: string | null;
	description?: string | null;
	image?: string | null;
	is_recurring: boolean;
	price: PlanPrice;
	metadata?: Record<string, string>;
	tax_category?: string;
	addons?: AddonDetailResponse[];
	meters?: MeterDetailResponse[];
	/** Backend plan type; use startsWith('monthly')/startsWith('annual') for UI partitioning. */
	plan_type?: PlanTypeBackend | string | null;
	show_discounted_badge?: boolean;
	includes_encryption?: boolean;
}

/**
 * Request body for POST /billing/checkout (CheckoutCreate).
 * Backend accepts only product_id and return_url.
 */
export interface CheckoutSessionRequest {
	product_id: string;
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
