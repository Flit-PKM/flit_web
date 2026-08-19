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
const refreshLogin = vi.fn();
const logoutApi = vi.fn();

vi.mock('../api/client', () => ({
	apiClient: {
		setToken: (...args: unknown[]) => setToken(...args),
		clearToken: (...args: unknown[]) => clearToken(...args),
		getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
		refreshLogin: (...args: unknown[]) => refreshLogin(...args),
		logout: (...args: unknown[]) => logoutApi(...args),
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

function jwtWithExp(secondsFromNow: number): string {
	const payload = btoa(
		JSON.stringify({ sub: 1, exp: Math.floor(Date.now() / 1000) + secondsFromNow })
	);
	return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
}

describe('auth store', () => {
	beforeEach(() => {
		installMemoryLocalStorage();
		localStorage.clear();
		vi.useRealTimers();
		vi.resetModules();
		getCurrentUser.mockReset();
		setToken.mockReset();
		clearToken.mockReset();
		refreshLogin.mockReset();
		logoutApi.mockReset();
		logoutApi.mockResolvedValue(undefined);
		refreshLogin.mockResolvedValue({
			access_token: jwtWithExp(1800),
			token_type: 'bearer'
		});
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

	it('logout revokes the server session then clears token and user', async () => {
		const { auth, authActions } = await import('./auth');
		auth.set({
			token: 't',
			user: sampleUser,
			isLoading: false
		});

		authActions.logout();

		const { get } = await import('svelte/store');
		expect(logoutApi).toHaveBeenCalled();
		expect(get(auth).token).toBeNull();
		expect(get(auth).user).toBeNull();
		expect(localStorage.getItem('auth_token')).toBeNull();
	});

	it('refreshes the login token on initialize when inside the lead window', async () => {
		const token = jwtWithExp(60);
		const next = jwtWithExp(1800);
		localStorage.setItem('auth_token', token);
		localStorage.setItem('auth_user', JSON.stringify(sampleUser));
		getCurrentUser.mockResolvedValue(sampleUser);
		refreshLogin.mockResolvedValue({ access_token: next, token_type: 'bearer' });

		const { auth, authActions } = await import('./auth');
		authActions.initialize();

		await vi.waitFor(() => {
			expect(refreshLogin).toHaveBeenCalled();
		});
		const { get } = await import('svelte/store');
		expect(get(auth).token).toBe(next);
	});

	it('schedules refresh until the lead window when token is still fresh', async () => {
		vi.useFakeTimers();
		const token = jwtWithExp(20 * 60);
		const next = jwtWithExp(30 * 60);
		localStorage.setItem('auth_token', token);
		localStorage.setItem('auth_user', JSON.stringify(sampleUser));
		getCurrentUser.mockResolvedValue(sampleUser);
		refreshLogin.mockResolvedValue({ access_token: next, token_type: 'bearer' });

		const { authActions } = await import('./auth');
		authActions.initialize();

		expect(refreshLogin).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 100);
		expect(refreshLogin).toHaveBeenCalled();
	});
});
