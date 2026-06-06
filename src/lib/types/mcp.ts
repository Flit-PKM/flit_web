/**
 * MCP API key and OAuth connection types (OpenAPI: McpApiKeyRead, McpApiKeyCreate,
 * McpApiKeyCreated, McpConnectionRead).
 */

export type McpApiKeyScope = 'read' | 'read write';

export interface McpApiKey {
	readonly id: number;
	name: string;
	key_prefix: string;
	scopes: string;
	readonly created_at: string;
	last_used_at: string | null;
}

/** Raw list item shape (backend may use `key_id` instead of `id`). */
export type McpApiKeyRaw = Partial<McpApiKey> & {
	key_id?: number;
	scope?: string;
};

export function normalizeMcpApiKey(raw: McpApiKeyRaw, index: number): McpApiKey | null {
	const id = raw.id ?? raw.key_id;
	if (id == null || typeof id !== 'number') {
		return null;
	}
	const scopes =
		typeof raw.scopes === 'string'
			? raw.scopes
			: typeof raw.scope === 'string'
				? raw.scope
				: 'read';
	return {
		id,
		name: typeof raw.name === 'string' ? raw.name : `API key ${index + 1}`,
		key_prefix: typeof raw.key_prefix === 'string' ? raw.key_prefix : '',
		scopes,
		created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
		last_used_at: raw.last_used_at ?? null
	};
}

export function normalizeMcpApiKeyList(payload: unknown): McpApiKey[] {
	const items: McpApiKeyRaw[] = Array.isArray(payload)
		? payload
		: payload != null &&
			  typeof payload === 'object' &&
			  Array.isArray((payload as { items?: unknown }).items)
			? ((payload as { items: McpApiKeyRaw[] }).items ?? [])
			: [];
	return items
		.map((item, index) => normalizeMcpApiKey(item, index))
		.filter((item): item is McpApiKey => item != null);
}

export interface McpApiKeyCreate {
	name: string;
	scope?: McpApiKeyScope;
}

export interface McpApiKeyCreated {
	readonly id: number;
	name: string;
	key_prefix: string;
	scopes: string;
	/** Plaintext key; shown only once on create. */
	api_key: string;
	readonly created_at: string;
}

export interface McpConnection {
	readonly id: number;
	client_id: string | null;
	client_name: string | null;
	scopes: string;
	readonly created_at: string;
	readonly expires_at: string;
}

/** Raw list item shape (backend may use `connection_id` instead of `id`). */
export type McpConnectionRaw = Partial<McpConnection> & {
	connection_id?: number;
};

export function normalizeMcpConnection(raw: McpConnectionRaw): McpConnection | null {
	const id = raw.id ?? raw.connection_id;
	if (id == null || typeof id !== 'number') {
		return null;
	}
	return {
		id,
		client_id: typeof raw.client_id === 'string' ? raw.client_id : null,
		client_name: typeof raw.client_name === 'string' ? raw.client_name : null,
		scopes: typeof raw.scopes === 'string' ? raw.scopes : 'read',
		created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
		expires_at: typeof raw.expires_at === 'string' ? raw.expires_at : new Date().toISOString()
	};
}

export function normalizeMcpConnectionList(payload: unknown): McpConnection[] {
	const items: McpConnectionRaw[] = Array.isArray(payload)
		? payload
		: payload != null &&
			  typeof payload === 'object' &&
			  Array.isArray((payload as { items?: unknown }).items)
			? ((payload as { items: McpConnectionRaw[] }).items ?? [])
			: [];
	return items
		.map((item) => normalizeMcpConnection(item))
		.filter((item): item is McpConnection => item != null);
}

export type McpAccessItem =
	| { kind: 'oauth'; connection: McpConnection }
	| { kind: 'bearer'; key: McpApiKey };

export function buildMcpAccessList(
	connections: McpConnection[],
	keys: McpApiKey[]
): McpAccessItem[] {
	const items: McpAccessItem[] = [
		...connections.map((connection) => ({ kind: 'oauth' as const, connection })),
		...keys.map((key) => ({ kind: 'bearer' as const, key }))
	];
	return items.sort((a, b) => {
		const aDate = a.kind === 'oauth' ? a.connection.created_at : a.key.created_at;
		const bDate = b.kind === 'oauth' ? b.connection.created_at : b.key.created_at;
		return bDate.localeCompare(aDate);
	});
}
