/**
 * API Client
 *
 * Robust HTTP client for communicating with the FastAPI backend.
 * Handles authentication, error recovery, and request/response processing.
 */

import type {
	AccessCodeActivateRequest,
	AccessCodeActivateResponse,
	ApiConfig,
	ApiResponse,
	RequestOptions,
	User,
	UserCreate,
	UserUpdate,
	AuthToken,
	PaginatedResponse,
	VerifySendResponse,
	PasswordResetRequestResponse,
	PasswordResetConfirm,
	PasswordResetConfirmResponse
} from '../types/auth';
import type { ConnectRequestCodeResponse, ConnectedApp } from '../types/connect';
import type {
	NoteRead,
	NoteDetail,
	CategoryRead,
	NoteUpdate,
	NoteCreate,
	CategoryCreate,
	RelationshipCreate,
	RelationshipRead
} from '../types/note';
import type {
	BillingCompleteRequest,
	BillingCompleteResponse,
	CheckoutSessionRequest,
	CheckoutSessionResponse,
	PlanDetailResponse,
	SubscriptionStatusResponse
} from '../types/billing';
import type { AccessCodeCreateResponse, SubscriptionRead } from '../types/admin';
import type { FeedbackCreate, FeedbackRead } from '../types/feedback';
import { errorLogger, handleApiError } from '$lib/utils/error-handler';

/**
 * Build query string from params (omits undefined and empty string).
 * Returns the query string without leading "?" (e.g. "skip=0&limit=10").
 */
function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') {
			searchParams.append(key, String(value));
		}
	}
	return searchParams.toString();
}

/**
 * Return path with optional query string (e.g. "/notes" or "/notes?search=foo").
 */
function endpointWithQuery(
	path: string,
	params: Record<string, string | number | boolean | undefined>
): string {
	const query = buildQueryString(params);
	return query ? `${path}?${query}` : path;
}

/**
 * Resolve API base URL: same origin in production (browser), else dev env or localhost.
 * Backend is mounted at /api, so all requests go to baseUrl + endpoint (e.g. /api/auth/login-json).
 */
function getApiBaseUrl(): string {
	const base =
		typeof window !== 'undefined' && import.meta.env.PROD
			? window.location.origin
			: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
	return base.replace(/\/$/, '') + '/api';
}

export class ApiClient {
	private config: ApiConfig;
	private token: string | null = null;

	constructor(config: Partial<ApiConfig> = {}) {
		this.config = {
			baseUrl: getApiBaseUrl(),
			timeout: 10000, // 10 seconds
			retries: 3,
			retryDelay: 1000, // 1 second
			...config
		};
	}

	/**
	 * Set the authentication token for subsequent requests
	 */
	setToken(token: string | null): void {
		this.token = token;
	}

	/**
	 * Get the current authentication token
	 */
	getToken(): string | null {
		return this.token;
	}

	/**
	 * Clear the authentication token
	 */
	clearToken(): void {
		this.token = null;
	}

	/**
	 * Make an authenticated HTTP request
	 */
	private async request<T>(
		endpoint: string,
		options: RequestOptions = {}
	): Promise<ApiResponse<T>> {
		const url = `${this.config.baseUrl}${endpoint}`;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...options.headers
		};

		// Add authorization header if token is available
		if (this.token) {
			headers['Authorization'] = `Bearer ${this.token}`;
		}

		const config: RequestInit = {
			method: options.method || 'GET',
			headers,
			body: options.body as BodyInit | null | undefined
		};

		// Convert body to JSON if it's an object
		if (options.body && typeof options.body === 'object') {
			config.body = JSON.stringify(options.body);
		}

		let lastError: Error = new Error('Request failed');

		// Retry logic for failed requests
		for (let attempt = 0; attempt <= this.config.retries; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(
					() => controller.abort(),
					options.timeout || this.config.timeout
				);

				const response = await fetch(url, {
					...config,
					signal: controller.signal
				});

				clearTimeout(timeoutId);

				// Handle authentication errors
				if (response.status === 401) {
					this.clearToken();
					// Trigger auth expiration handling
					if (typeof window !== 'undefined') {
						window.dispatchEvent(new CustomEvent('auth:expired'));
					}
					throw new HttpError('Authentication required', response.status);
				}

				// Handle other HTTP errors
				if (!response.ok) {
					let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

					try {
						const errorData: { detail: string } = await response.json();
						errorMessage = errorData.detail || errorMessage;
					} catch {
						// If we can't parse the error response, use the default message
					}

					throw new HttpError(errorMessage, response.status);
				}

				// 204 No Content / 205 Reset Content have no body
				if (response.status === 204 || response.status === 205) {
					return {
						data: undefined as T,
						status: response.status,
						headers: response.headers
					};
				}

				// Parse successful response
				let data: T;
				const contentType = response.headers.get('content-type');

				if (contentType?.includes('application/json')) {
					data = await response.json();
				} else {
					data = (await response.text()) as T;
				}

				return {
					data,
					status: response.status,
					headers: response.headers
				};
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Log the error with context
				errorLogger.logError(lastError, {
					component: 'ApiClient',
					operation: 'request',
					endpoint,
					attempt,
					method: options.method || 'GET'
				});

				// Don't retry on authentication errors or client errors
				if (
					error instanceof HttpError &&
					(error.status === 401 || (error.status >= 400 && error.status < 500))
				) {
					break;
				}

				// Don't retry on abort errors (timeout)
				if (error instanceof Error && error.name === 'AbortError') {
					break;
				}

				// Wait before retrying (except on last attempt)
				if (attempt < this.config.retries) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.config.retryDelay * (attempt + 1))
					);
				}
			}
		}

		// Re-throw the last error with proper handling
		const handledError = handleApiError(lastError, {
			component: 'ApiClient',
			operation: 'request',
			endpoint,
			method: options.method || 'GET'
		});
		throw handledError;
	}

	/**
	 * Authentication endpoints
	 */
	async login(email: string, password: string): Promise<AuthToken> {
		const response = await this.request<AuthToken>('/auth/login-json', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: {
				email: email,
				password: password
			}
		});

		// Automatically set the token for future requests
		this.setToken(response.data.access_token);

		return response.data;
	}

	async register(userData: UserCreate): Promise<User> {
		const response = await this.request<User>('/auth/register', {
			method: 'POST',
			body: userData
		});

		return response.data;
	}

	/**
	 * User management endpoints
	 */
	async getUsers(params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<User>> {
		const endpoint = endpointWithQuery('/users/', params);

		const response = await this.request<User[]>(endpoint, {
			method: 'GET'
		});

		// Transform array response to paginated response
		return {
			items: response.data,
			total: parseInt(response.headers.get('x-total-count') || '0'),
			skip: params.skip || 0,
			limit: params.limit || 10
		};
	}

	async getUser(userId: number): Promise<User> {
		const response = await this.request<User>(`/users/${userId}`, {
			method: 'GET'
		});

		return response.data;
	}

	async updateUser(userId: number, userData: UserUpdate): Promise<User> {
		const response = await this.request<User>(`/users/${userId}`, {
			method: 'PATCH',
			body: userData
		});

		return response.data;
	}

	async deleteUser(userId: number): Promise<void> {
		await this.request(`/users/${userId}`, {
			method: 'DELETE'
		});
	}

	/**
	 * Grant superuser privilege to a user. POST /users/{user_id}/superuser. Superuser only.
	 */
	async grantSuperuser(userId: number): Promise<User> {
		const response = await this.request<User>(`/users/${userId}/superuser`, {
			method: 'POST'
		});
		return response.data;
	}

	/**
	 * Revoke superuser privilege from a user. DELETE /users/{user_id}/superuser. Superuser only.
	 */
	async revokeSuperuser(userId: number): Promise<User> {
		const response = await this.request<User>(`/users/${userId}/superuser`, {
			method: 'DELETE'
		});
		return response.data;
	}

	/**
	 * List newsletter subscriptions. GET /subscriptions/?skip=&limit=. Superuser only.
	 */
	async getSubscriptions(
		params: { skip?: number; limit?: number } = {}
	): Promise<SubscriptionRead[]> {
		const endpoint = endpointWithQuery('/subscriptions/', params);
		const response = await this.request<SubscriptionRead[]>(endpoint, { method: 'GET' });
		return response.data;
	}

	/**
	 * Create a single-use access code. GET /access-codes/create?period_weeks=&includes_encryption=. Superuser only.
	 */
	async createAccessCode(params: {
		period_weeks: number;
		includes_encryption: boolean;
	}): Promise<AccessCodeCreateResponse> {
		const endpoint = endpointWithQuery('/access-codes/create', {
			period_weeks: params.period_weeks,
			includes_encryption: params.includes_encryption
		});
		const response = await this.request<AccessCodeCreateResponse>(endpoint, { method: 'GET' });
		return response.data;
	}

	/**
	 * Activate an access code for the current user. POST /access-codes/activate. Requires Bearer auth.
	 */
	async activateAccessCode(body: AccessCodeActivateRequest): Promise<AccessCodeActivateResponse> {
		const response = await this.request<AccessCodeActivateResponse>('/access-codes/activate', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Request a connection code for linking an app to Flit Core.
	 * POST /connect/request-code with no body. Requires Bearer auth.
	 */
	async requestConnectCode(): Promise<ConnectRequestCodeResponse> {
		const response = await this.request<ConnectRequestCodeResponse>('/connect/request-code', {
			method: 'POST'
		});
		return response.data;
	}

	/**
	 * Send verification email to the current user.
	 * GET /verify. Requires Bearer auth.
	 */
	async sendVerificationEmail(): Promise<VerifySendResponse> {
		const response = await this.request<VerifySendResponse>('/verify', {
			method: 'GET'
		});
		return response.data;
	}

	/**
	 * Request password reset email. POST /password-reset/request. Public.
	 */
	async requestPasswordReset(
		email: string,
		cfTurnstileResponse?: string | null
	): Promise<PasswordResetRequestResponse> {
		const body: { email: string; cf_turnstile_response?: string | null } = { email };
		if (cfTurnstileResponse) {
			body.cf_turnstile_response = cfTurnstileResponse;
		}
		const response = await this.request<PasswordResetRequestResponse>('/password-reset/request', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Confirm password reset with token. POST /password-reset/confirm. Public.
	 */
	async confirmPasswordReset(body: PasswordResetConfirm): Promise<PasswordResetConfirmResponse> {
		const response = await this.request<PasswordResetConfirmResponse>('/password-reset/confirm', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Get all connected apps for the current user.
	 * GET /connected-apps. Requires Bearer auth.
	 */
	async getConnectedApps(): Promise<ConnectedApp[]> {
		const response = await this.request<ConnectedApp[]>('/connected-apps', {
			method: 'GET'
		});
		return response.data;
	}

	/**
	 * Revoke (delete) a connected app for the current user.
	 * DELETE /connected-apps/{connected_app_id}. Requires Bearer auth.
	 */
	async revokeConnectedApp(connectedAppId: number): Promise<void> {
		await this.request<void>(`/connected-apps/${connectedAppId}`, {
			method: 'DELETE'
		});
	}

	/**
	 * List available subscription plans. GET /billing/plans. Public; no auth required.
	 * Returns plans with product_id, name, description, price, addons. Cached on backend.
	 */
	async getBillingPlans(): Promise<PlanDetailResponse[]> {
		const response = await this.request<PlanDetailResponse[]>('/billing/plans', {
			method: 'GET'
		});
		return response.data;
	}

	/**
	 * Create a Dodo checkout session. POST /billing/checkout. Requires Bearer auth.
	 * Pass product_id (required) and optional return_url. Redirect the user to checkout_url to complete payment.
	 */
	async createCheckoutSession(body: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
		const response = await this.request<CheckoutSessionResponse>('/billing/checkout', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Get current user's subscription status. GET /billing/subscription. Requires Bearer auth.
	 * Returns status, current_period_end, dodo_subscription_id (all null when not subscribed).
	 */
	async getSubscription(): Promise<SubscriptionStatusResponse> {
		const response = await this.request<SubscriptionStatusResponse>('/billing/subscription', {
			method: 'GET'
		});
		return response.data;
	}

	/**
	 * Notify backend of subscription success after redirect from payment provider.
	 * POST /billing/complete. Requires Bearer auth.
	 */
	async postBillingComplete(body: BillingCompleteRequest): Promise<BillingCompleteResponse> {
		const response = await this.request<BillingCompleteResponse>('/billing/complete', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Submit feedback. POST /feedback. Public; no auth required.
	 */
	async submitFeedback(body: FeedbackCreate): Promise<FeedbackRead> {
		const response = await this.request<FeedbackRead>('/feedback', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * List feedback. GET /feedback. Superuser only.
	 */
	async listFeedback(params: { skip?: number; limit?: number } = {}): Promise<FeedbackRead[]> {
		const endpoint = endpointWithQuery('/feedback', params);
		const response = await this.request<FeedbackRead[]>(endpoint, { method: 'GET' });
		return response.data;
	}

	/**
	 * Delete feedback. DELETE /feedback/{id}. Superuser only.
	 */
	async deleteFeedback(feedbackId: number): Promise<void> {
		await this.request<void>(`/feedback/${feedbackId}`, {
			method: 'DELETE'
		});
	}

	/**
	 * Get current user profile using the authentication token
	 * Calls GET /user/ endpoint which uses the Bearer token to identify the current user
	 */
	async getCurrentUser(): Promise<User> {
		const response = await this.request<User>('/user/', {
			method: 'GET'
		});

		return response.data;
	}

	/**
	 * Update current user profile using the authentication token
	 * Calls PATCH /user/ endpoint which uses the Bearer token to identify the current user
	 */
	async updateCurrentUser(userData: UserUpdate): Promise<User> {
		const response = await this.request<User>('/user/', {
			method: 'PATCH',
			body: userData
		});

		return response.data;
	}

	/**
	 * List all notes for the authenticated user.
	 * GET /notes. Requires Bearer auth.
	 * @param params.skip - Number of items to skip (pagination)
	 * @param params.limit - Maximum number of items to return
	 * @param params.search - Search in title and content
	 * @param params.filter - Filter by category name
	 */
	async getNotes(
		params: { skip?: number; limit?: number; search?: string; filter?: string } = {}
	): Promise<NoteRead[]> {
		const endpoint = endpointWithQuery('/notes', params);
		const response = await this.request<NoteRead[]>(endpoint, { method: 'GET' });
		return response.data;
	}

	/**
	 * List all categories for the authenticated user.
	 * GET /categories. Requires Bearer auth.
	 */
	async getCategories(params: { skip?: number; limit?: number } = {}): Promise<CategoryRead[]> {
		const endpoint = endpointWithQuery('/categories', params);
		const response = await this.request<CategoryRead[]>(endpoint, { method: 'GET' });
		return response.data;
	}

	/**
	 * Get a single note by ID (expanded: includes relationships and categories). Verifies ownership.
	 * GET /notes/{note_id}. Requires Bearer auth.
	 */
	async getNote(noteId: number): Promise<NoteDetail> {
		const response = await this.request<NoteDetail>(`/notes/${noteId}`, { method: 'GET' });
		return response.data;
	}

	/**
	 * Create a note. POST /notes. Returns the created note (201).
	 */
	async createNote(body: NoteCreate): Promise<NoteRead> {
		const response = await this.request<NoteRead>('/notes', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Update a note. PUT /notes/{note_id}. Verifies ownership.
	 */
	async updateNote(noteId: number, body: NoteUpdate): Promise<NoteRead> {
		const response = await this.request<NoteRead>(`/notes/${noteId}`, {
			method: 'PUT',
			body
		});
		return response.data;
	}

	/**
	 * Delete a note. DELETE /notes/{note_id}. Verifies ownership.
	 */
	async deleteNote(noteId: number): Promise<void> {
		await this.request<void>(`/notes/${noteId}`, {
			method: 'DELETE'
		});
	}

	/**
	 * Create a category. POST /categories.
	 */
	async createCategory(body: CategoryCreate): Promise<CategoryRead> {
		const response = await this.request<CategoryRead>('/categories', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Delete a category. DELETE /categories/{category_id}.
	 */
	async deleteCategory(categoryId: number): Promise<void> {
		await this.request<void>(`/categories/${categoryId}`, {
			method: 'DELETE'
		});
	}

	/**
	 * Create a relationship between two notes. POST /relationships.
	 */
	async createRelationship(body: RelationshipCreate): Promise<RelationshipRead> {
		const response = await this.request<RelationshipRead>('/relationships', {
			method: 'POST',
			body
		});
		return response.data;
	}

	/**
	 * Delete a relationship. DELETE /relationships/{note_a_id}/{note_b_id}.
	 */
	async deleteRelationship(noteAId: number, noteBId: number): Promise<void> {
		await this.request<void>(`/relationships/${noteAId}/${noteBId}`, {
			method: 'DELETE'
		});
	}

	/**
	 * Add a category to a note. POST /note-categories.
	 */
	async addCategoryToNote(noteId: number, categoryId: number): Promise<void> {
		await this.request<void>('/note-categories', {
			method: 'POST',
			body: { note_id: noteId, category_id: categoryId }
		});
	}

	/**
	 * Remove a category from a note. DELETE /note-categories/{note_id}/{category_id}.
	 */
	async removeCategoryFromNote(noteId: number, categoryId: number): Promise<void> {
		await this.request<void>(`/note-categories/${noteId}/${categoryId}`, {
			method: 'DELETE'
		});
	}
}

/**
 * Custom API error class
 */
export class HttpError extends Error {
	public readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
	}
}

/**
 * Singleton instance for the application
 */
export const apiClient = new ApiClient();

// Export factory function for testing
export const createApiClient = (config?: Partial<ApiConfig>) => new ApiClient(config);
