/**
 * Admin / superuser dashboard types
 *
 * Aligned with FastAPI backend API (subscriptions, access codes).
 */

/**
 * Newsletter subscription as returned by GET /subscriptions/
 */
export interface SubscriptionRead {
	id: number;
	email: string;
	created_at: string; // ISO 8601 datetime
}

/**
 * Response when a superuser creates a new access code (GET /access-codes/create).
 * Code is single-use and not shown again.
 */
export interface AccessCodeCreateResponse {
	code: string;
	period_weeks: number;
	includes_encryption: boolean;
}
