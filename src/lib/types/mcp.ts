/**
 * MCP API key types (OpenAPI: McpApiKeyRead, McpApiKeyCreate, McpApiKeyCreated).
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
