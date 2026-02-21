/**
 * Authentication and User Management Types
 *
 * TypeScript interfaces and types for the authentication system,
 * aligned with FastAPI backend API specification.
 */

/**
 * Color scheme preference type
 */
export type ColorScheme = 'light' | 'dark' | 'default';

/**
 * User's subscription as returned on UserRead (at most one per user).
 * product_id is optional; when present, matches plan.product_id for the current plan card.
 */
export interface UserSubscriptionRead {
	status: string | null;
	current_period_end: string | null;
	dodo_subscription_id: string | null;
	product_id?: string | null;
}

/**
 * Active access-code grant on UserRead (time-limited access without subscription).
 */
export interface UserAccessGrantRead {
	expires_at: string; // ISO 8601
	includes_encryption: boolean;
}

/**
 * User model as returned by the API
 */
export interface User {
	readonly id: number;
	username: string;
	email: string;
	color_scheme: ColorScheme | null;
	readonly is_active: boolean;
	readonly is_superuser: boolean;
	readonly is_verified: boolean;
	readonly created_at: string; // ISO 8601 datetime string
	readonly updated_at: string; // ISO 8601 datetime string
	subscription?: UserSubscriptionRead | null;
	access_grant?: UserAccessGrantRead | null;
	entitlement_active?: boolean;
}

/**
 * Request body for POST /access-codes/activate.
 */
export interface AccessCodeActivateRequest {
	code: string;
}

/**
 * Response when a user successfully activates an access code.
 */
export interface AccessCodeActivateResponse {
	expires_at: string;
	includes_encryption: boolean;
}

/**
 * Response for GET /verify (send verification email).
 */
export interface VerifySendResponse {
	sent: boolean;
	detail?: string | null;
}

/**
 * User creation/update request data
 */
export interface UserCreate {
	email: string;
	password: string;
	cf_turnstile_response?: string | null;
	is_active?: boolean;
	is_superuser?: boolean;
	is_verified?: boolean;
}

/**
 * Partial user update data for PATCH operations
 */
export interface UserUpdate {
	current_password?: string;
	username?: string;
	email?: string;
	password?: string;
	color_scheme?: ColorScheme | null;
	is_active?: boolean;
	is_superuser?: boolean;
	is_verified?: boolean;
}

/**
 * Authentication token response
 */
export interface AuthToken {
	access_token: string;
	token_type: 'bearer';
}

/**
 * Request body for POST /password-reset/request.
 */
export interface PasswordResetRequest {
	email: string;
	cf_turnstile_response?: string | null;
}

/**
 * Response for POST /password-reset/request.
 */
export interface PasswordResetRequestResponse {
	sent: boolean;
	detail?: string | null;
}

/**
 * Request body for POST /password-reset/confirm.
 */
export interface PasswordResetConfirm {
	token: string;
	new_password: string;
}

/**
 * Response for POST /password-reset/confirm.
 */
export interface PasswordResetConfirmResponse {
	success: boolean;
	detail?: string | null;
}

/**
 * Login form data
 */
export interface LoginFormData extends Record<string, unknown> {
	email: string;
	password: string;
}

/**
 * Registration form data
 */
export interface RegisterFormData extends Record<string, unknown> {
	email: string;
	password: string;
	confirmPassword: string;
	cf_turnstile_response?: string | null;
}

/**
 * Profile update form data
 */
export interface ProfileFormData extends Record<string, unknown> {
	username: string;
	email: string;
	colorScheme: ColorScheme;
	currentPassword?: string;
	newPassword?: string;
	confirmNewPassword?: string;
}

/**
 * API error response structure
 */
export interface ApiError {
	detail: string;
}

/**
 * Authentication state in the application
 */
export interface AuthState {
	token: string | null;
	user: User | null;
	isLoading: boolean;
}

/**
 * Form validation errors
 */
export interface FormErrors {
	username?: string;
	email?: string;
	password?: string;
	confirmPassword?: string;
	currentPassword?: string;
	newPassword?: string;
	confirmNewPassword?: string;
	general?: string;
	[key: string]: string | undefined;
}

/**
 * Form field states for validation
 */
export interface FormFieldState {
	value: string;
	error: string | null;
	isDirty: boolean;
	isValid: boolean;
}

/**
 * API client configuration
 */
export interface ApiConfig {
	baseUrl: string;
	timeout: number;
	retries: number;
	retryDelay: number;
}

/**
 * HTTP request options
 */
export interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	headers?: Record<string, string>;
	body?: unknown;
	timeout?: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
	data: T;
	status: number;
	headers: Headers;
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
	skip?: number;
	limit?: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	skip: number;
	limit: number;
}
