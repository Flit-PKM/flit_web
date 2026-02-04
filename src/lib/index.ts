/**
 * Flit Web Library Exports
 *
 * Centralized exports for all library modules.
 * Use these imports throughout the application for consistency.
 */

// API Client
export { apiClient, HttpError, createApiClient } from './api/client';

// Authentication Store
export {
	auth,
	authActions,
	isAuthenticated,
	currentUser,
	isLoading,
	authToken
} from './stores/auth';

// Utilities
export * from './utils/auth';
export * from './utils/validation';

// Types
export type {
	User,
	UserCreate,
	UserUpdate,
	AuthToken,
	LoginFormData,
	RegisterFormData,
	ProfileFormData,
	AuthState,
	FormErrors,
	ApiError as ApiErrorType,
	ApiResponse,
	PaginationParams,
	PaginatedResponse
} from './types/auth';
