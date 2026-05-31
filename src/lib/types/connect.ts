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

/** Raw list item shape (backend may use `connected_app_id` instead of `id`). */
export type ConnectedAppRaw = Partial<ConnectedApp> & {
	connected_app_id?: number;
};

export function normalizeConnectedApp(raw: ConnectedAppRaw, index: number): ConnectedApp | null {
	const id = raw.id ?? raw.connected_app_id;
	if (id == null || typeof id !== 'number') {
		return null;
	}
	return {
		id,
		app_slug: typeof raw.app_slug === 'string' ? raw.app_slug : 'unknown',
		app_name: raw.app_name ?? null,
		user_id: typeof raw.user_id === 'number' ? raw.user_id : 0,
		device_name: typeof raw.device_name === 'string' ? raw.device_name : `Device ${index + 1}`,
		platform: raw.platform ?? null,
		app_version: raw.app_version ?? null,
		is_active: Boolean(raw.is_active),
		created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
		updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : new Date().toISOString()
	};
}

export function normalizeConnectedAppList(payload: unknown): ConnectedApp[] {
	const items: ConnectedAppRaw[] = Array.isArray(payload)
		? payload
		: payload != null &&
			  typeof payload === 'object' &&
			  Array.isArray((payload as { items?: unknown }).items)
			? ((payload as { items: ConnectedAppRaw[] }).items ?? [])
			: [];
	return items
		.map((item, index) => normalizeConnectedApp(item, index))
		.filter((item): item is ConnectedApp => item != null);
}
