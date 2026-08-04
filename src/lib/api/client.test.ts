/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import { ApiClient, formatApiDetail } from './client';

describe('formatApiDetail', () => {
	it('returns string detail', () => {
		expect(formatApiDetail('Nope', 'fallback')).toBe('Nope');
	});

	it('joins FastAPI validation array', () => {
		expect(formatApiDetail([{ loc: ['body', 'email'], msg: 'invalid email' }], 'fallback')).toBe(
			'invalid email'
		);
	});

	it('falls back for null', () => {
		expect(formatApiDetail(null, 'fallback')).toBe('fallback');
	});
});

describe('ApiClient', () => {
	let client: ApiClient;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.stubGlobal('console', {
			...console,
			error: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn()
		});
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		client = new ApiClient({
			baseUrl: 'http://localhost:8000/api',
			timeout: 5000,
			retries: 1,
			retryDelay: 1
		});
		client.clearToken();
	});

	it('sends Authorization header when token is set', async () => {
		client.setToken('tok_abc');
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ id: 1 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		await client.getCurrentUser();

		expect(fetchMock).toHaveBeenCalled();
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok_abc');
	});

	it('dispatches auth:expired and clears token on 401', async () => {
		client.setToken('stale');
		const expired = vi.fn();
		window.addEventListener('auth:expired', expired);

		fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

		await expect(client.getCurrentUser()).rejects.toMatchObject({
			message: 'Authentication required',
			status: 401
		});
		expect(client['token']).toBeNull();
		expect(expired).toHaveBeenCalled();

		window.removeEventListener('auth:expired', expired);
	});

	it('formats array detail on error responses', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ detail: [{ msg: 'field required' }] }), {
				status: 422,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		await expect(client.getCurrentUser()).rejects.toMatchObject({
			message: 'field required'
		});
	});

	it('retries safe GET once on network failure then succeeds', async () => {
		fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(
			new Response(JSON.stringify({ id: 1 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const user = await client.getCurrentUser();
		expect(user).toEqual({ id: 1 });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('does not retry POST on 500', async () => {
		fetchMock.mockResolvedValue(new Response('fail', { status: 500 }));

		await expect(client.login('a@b.com', 'Secret1!')).rejects.toBeInstanceOf(Error);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
