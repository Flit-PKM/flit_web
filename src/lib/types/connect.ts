/**
 * Connect API types
 *
 * Types for the /connect/request-code flow (connection code for linking apps to Flit Core).
 */

/**
 * Response from POST /connect/request-code.
 * Only connection_code is required; expires_in and app are optional.
 */
export interface ConnectRequestCodeResponse {
	connection_code: string;
	expires_in?: number;
	app?: string;
}

/**
 * Connected app model as returned by the API
 */
export interface ConnectedApp {
	readonly id: number;
	app_slug: string;
	app_name: string | null;
	readonly user_id: number;
	device_name: string;
	platform: string | null;
	app_version: string | null;
	is_active: boolean;
	readonly created_at: string; // ISO 8601 datetime string
	readonly updated_at: string; // ISO 8601 datetime string
}
