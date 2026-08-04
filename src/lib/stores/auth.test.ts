/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));
vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

const getCurrentUser = vi.fn();
const setToken = vi.fn();
const clearToken = vi.fn();

vi.mock('../api/client', () => ({
	apiClient: {
		setToken: (...args: unknown[]) => setToken(...args),
		clearToken: (...args: unknown[]) => clearToken(...args),
		getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
		login: vi.fn(),
		loginWithGoogle: vi.fn(),
		register: vi.fn()
	},
	HttpError: class HttpError extends Error {
		status: number;
		constructor(message: string, status: number) {
			super(message);
			this.status = status;
		}
	}
}));

function installMemoryLocalStorage(): void {
	const map = new Map<string, string>();
	const memory = {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => {
			map.set(key, String(value));
		},
		removeItem: (key: string) => {
			map.delete(key);
		},
		clear: () => {
			map.clear();
		},
		get length() {
			return map.size;
		},
		key: (index: number) => [...map.keys()][index] ?? null
	};
	Object.defineProperty(globalThis, 'localStorage', {
		value: memory,
		configurable: true,
		writable: true
	});
	Object.defineProperty(window, 'localStorage', {
		value: memory,
		configurable: true,
		writable: true
	});
}

const sampleUser = {
	id: 1,
	email: 'a@b.com',
	username: 'a',
	color_scheme: null,
	is_active: true,
	is_superuser: false,
	is_verified: true,
	created_at: '2025-01-01T00:00:00Z',
	updated_at: '2025-01-01T00:00:00Z'
};

describe('auth store', () => {
	beforeEach(() => {
		installMemoryLocalStorage();
		localStorage.clear();
		vi.resetModules();
		getCurrentUser.mockReset();
		setToken.mockReset();
		clearToken.mockReset();
	});

	it('treats base64url JWT with future exp as authenticated when user is stored', async () => {
		const json = JSON.stringify({
			sub: 'user+/=',
			exp: Math.floor(Date.now() / 1000) + 3600,
			n: '>>>???>>>'
		});
		const payload = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
		localStorage.setItem('auth_token', token);
		localStorage.setItem('auth_user', JSON.stringify(sampleUser));
		getCurrentUser.mockResolvedValue(sampleUser);

		const { auth, isAuthenticated, authActions } = await import('./auth');
		authActions.initialize();

		const { get } = await import('svelte/store');
		expect(get(isAuthenticated)).toBe(true);
		expect(get(auth).token).toBe(token);
		expect(getCurrentUser).toHaveBeenCalled();
	});

	it('clears orphan token without user', async () => {
		localStorage.setItem('auth_token', 'a.b.c');
		localStorage.removeItem('auth_user');

		const { auth, isAuthenticated, authActions } = await import('./auth');
		authActions.initialize();

		const { get } = await import('svelte/store');
		expect(get(isAuthenticated)).toBe(false);
		expect(get(auth).token).toBeNull();
		expect(localStorage.getItem('auth_token')).toBeNull();
	});

	it('logout clears token and user', async () => {
		const { auth, authActions } = await import('./auth');
		auth.set({
			token: 't',
			user: sampleUser,
			isLoading: false
		});

		authActions.logout();

		const { get } = await import('svelte/store');
		expect(get(auth).token).toBeNull();
		expect(get(auth).user).toBeNull();
		expect(localStorage.getItem('auth_token')).toBeNull();
	});
});
