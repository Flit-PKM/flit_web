/**
 * Authentication Store
 *
 * Reactive state management for authentication with localStorage persistence.
 * Provides centralized auth state and actions throughout the application.
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { apiClient, HttpError } from '../api/client';
import { isTokenExpired } from '../utils/auth';
import { handleApiError, formatErrorForUser } from '../utils/error-handler';
import type { AuthState, User, LoginFormData, RegisterFormData } from '../types/auth';

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Initialize state from localStorage (client-side only)
function initializeAuthState(): AuthState {
	if (!browser) {
		return {
			token: null,
			user: null,
			isLoading: false
		};
	}

	const token = localStorage.getItem(TOKEN_KEY);
	const userJson = localStorage.getItem(USER_KEY);
	let user: User | null = null;

	try {
		user = userJson ? JSON.parse(userJson) : null;
	} catch (error) {
		console.warn('Failed to parse stored user data:', error);
		localStorage.removeItem(USER_KEY);
	}

	// Treat expired token as no auth so we never show authenticated UI or loading
	if (token && isTokenExpired(token)) {
		return {
			token: null,
			user: null,
			isLoading: false
		};
	}

	return {
		token,
		user,
		isLoading: false
	};
}

// Create the writable store
const authStore = writable<AuthState>(initializeAuthState());

// Persist changes to localStorage
authStore.subscribe((state) => {
	if (!browser) return;

	if (state.token) {
		localStorage.setItem(TOKEN_KEY, state.token);
		apiClient.setToken(state.token);
	} else {
		localStorage.removeItem(TOKEN_KEY);
		apiClient.clearToken();
	}

	if (state.user) {
		localStorage.setItem(USER_KEY, JSON.stringify(state.user));
	} else {
		localStorage.removeItem(USER_KEY);
	}
});

// Derived stores for convenience (isAuthenticated is derived from token + user only)
export const isAuthenticated = derived(authStore, ($auth) => !!($auth.token && $auth.user));
export const currentUser = derived(authStore, ($auth) => $auth.user);
export const isLoading = derived(authStore, ($auth) => $auth.isLoading);
export const authToken = derived(authStore, ($auth) => $auth.token);

// Authentication actions
export const authActions = {
	/**
	 * Login with email and password
	 */
	async login(credentials: LoginFormData): Promise<{ success: boolean; error?: string }> {
		authStore.update((state) => ({ ...state, isLoading: true }));

		try {
			const tokenResponse = await apiClient.login(credentials.email, credentials.password);

			// Fetch complete user data using the auth token
			const userData = await apiClient.getCurrentUser();

			authStore.set({
				token: tokenResponse.access_token,
				user: userData,
				isLoading: false
			});

			return { success: true };
		} catch (error) {
			authStore.update((state) => ({
				...state,
				isLoading: false
			}));
			const errorMessage = formatErrorForUser(handleApiError(error, { operation: 'login' }));
			return { success: false, error: errorMessage };
		}
	},

	/**
	 * Register a new user account
	 */
	async register(userData: RegisterFormData): Promise<{ success: boolean; error?: string }> {
		authStore.update((state) => ({ ...state, isLoading: true }));

		try {
			await apiClient.register({
				email: userData.email,
				password: userData.password
			});

			authStore.set({
				token: null, // Registration doesn't return a token
				user: null, // Clear any existing user data
				isLoading: false
			});

			return { success: true };
		} catch (error) {
			authStore.update((state) => ({ ...state, isLoading: false }));
			const errorMessage = formatErrorForUser(handleApiError(error, { operation: 'register' }));
			return { success: false, error: errorMessage };
		}
	},

	/**
	 * Logout the current user
	 */
	logout(): void {
		authStore.set({
			token: null,
			user: null,
			isLoading: false
		});

		// Navigate to login page
		goto(resolve('/login'));
	},

	/**
	 * Update user data in the store
	 */
	updateUser(user: User): void {
		authStore.update((state) => ({
			...state,
			user
		}));
	},

	/**
	 * Check if user is authenticated and redirect if not
	 */
	requireAuth(): boolean {
		const state = get(authStore);
		if (!state.token || !state.user) {
			goto(resolve('/login'));
			return false;
		}
		return true;
	},

	/**
	 * Refresh user data from the API
	 */
	async refreshUser(): Promise<void> {
		const state = get(authStore);
		// Check if user is authenticated (has token)
		if (!state.token) return;

		try {
			const user = await apiClient.getCurrentUser();
			authStore.update((state) => ({ ...state, user }));
		} catch (error) {
			console.error('Failed to refresh user data:', error);

			// Only logout on 401 (unauthorized) - token is invalid/expired
			if (error instanceof HttpError && error.status === 401) {
				this.logout();
			}
			// For other errors (network, 404, etc.), keep user logged in but log the error
		}
	},

	/**
	 * Initialize auth state (call on app start)
	 */
	initialize(): void {
		const state = initializeAuthState();

		if (state.token) {
			apiClient.setToken(state.token);
		}

		authStore.set(state);

		// Listen for auth expiration events from API client
		if (browser) {
			window.addEventListener('auth:expired', () => {
				this.logout();
			});
		}
	}
};

// Export the store itself for direct access when needed
export const auth = authStore;

// Export everything as a default object for convenience
export default {
	subscribe: authStore.subscribe,
	...authActions
};
