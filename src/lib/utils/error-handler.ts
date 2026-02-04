/**
 * Centralized Error Handling System
 *
 * Provides consistent error handling, logging, and user feedback
 * across the entire application.
 */

import type { HttpError } from '$lib/api/client';
import { browser } from '$app/environment';

/**
 * Error context for logging and debugging
 */
export interface ErrorContext {
	component?: string;
	operation?: string;
	userId?: string;
	noteId?: number;
	action?: string;
	timestamp?: number;
	[key: string]: any;
}

/**
 * Application error type with enhanced context
 */
export class AppError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly context?: ErrorContext,
		public readonly originalError?: Error
	) {
		super(message);
		this.name = 'AppError';
	}
}

/**
 * API error with status and response details
 */
export class ApiError extends AppError {
	constructor(
		message: string,
		public readonly status: number,
		public readonly response?: any,
		context?: ErrorContext,
		originalError?: Error
	) {
		super(message, 'API_ERROR', context, originalError);
		this.name = 'ApiError';
	}
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
	constructor(
		message: string,
		public readonly field?: string,
		context?: ErrorContext,
		originalError?: Error
	) {
		super(message, 'VALIDATION_ERROR', context, originalError);
		this.name = 'ValidationError';
	}
}

/**
 * Network error
 */
export class NetworkError extends AppError {
	constructor(message: string, context?: ErrorContext, originalError?: Error) {
		super(message, 'NETWORK_ERROR', context, originalError);
		this.name = 'NetworkError';
	}
}

/**
 * Logger for consistent application error reporting
 */
export class ErrorLogger {
	private static instance: ErrorLogger;
	private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error';

	private constructor() {}

	static getInstance(): ErrorLogger {
		if (!ErrorLogger.instance) {
			ErrorLogger.instance = new ErrorLogger();
		}
		return ErrorLogger.instance;
	}

	/**
	 * Set log level
	 */
	setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
		this.logLevel = level;
	}

	/**
	 * Log an error with context
	 */
	logError(error: Error, context?: ErrorContext): void {
		const errorInfo = {
			timestamp: new Date().toISOString(),
			message: error.message,
			stack: error.stack,
			name: error.name,
			context,
			userAgent: browser ? navigator.userAgent : 'server',
			url: browser ? window.location.href : undefined
		};

		// Log to console based on log level
		if (this.logLevel === 'error' || this.logLevel === 'warn') {
			console.error('[ERROR]', errorInfo);
		} else if (this.logLevel === 'info') {
			console.info('[ERROR]', errorInfo);
		} else {
			console.debug('[ERROR]', errorInfo);
		}

		// Send to external error tracking service (if available)
		this.reportToExternalService(error, context);
	}

	/**
	 * Log a warning
	 */
	logWarning(message: string, context?: ErrorContext): void {
		const warningInfo = {
			timestamp: new Date().toISOString(),
			message,
			context,
			userAgent: browser ? navigator.userAgent : 'server',
			url: browser ? window.location.href : undefined
		};

		if (this.logLevel === 'warn' || this.logLevel === 'error') {
			console.warn('[WARNING]', warningInfo);
		}
	}

	/**
	 * Log debug information
	 */
	logDebug(message: string, context?: ErrorContext): void {
		if (this.logLevel === 'debug') {
			const debugInfo = {
				timestamp: new Date().toISOString(),
				message,
				context,
				userAgent: browser ? navigator.userAgent : 'server',
				url: browser ? window.location.href : undefined
			};
			console.debug('[DEBUG]', debugInfo);
		}
	}

	/**
	 * Report error to external services (Sentry, etc.)
	 */
	private async reportToExternalService(error: Error, context?: ErrorContext): Promise<void> {
		// In a real application, this would integrate with Sentry, Rollbar, or similar
		// For now, we just log to console but this is where external reporting would go

		try {
			// Example integration (uncomment if using external service):
			// if (typeof Sentry !== 'undefined') {
			//   Sentry.captureException(error, {
			//     contexts: {
			//       errorContext: context,
			//       browser: browser ? {
			//         userAgent: navigator.userAgent,
			//         url: window.location.href
			//       } : undefined
			//     }
			//   });
			// }
		} catch (reportError) {
			// Don't let reporting errors break the app
			console.error('Failed to report error to external service:', reportError);
		}
	}
}

/**
 * Global error handler instance
 */
export const errorLogger = ErrorLogger.getInstance();

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown, context?: ErrorContext): AppError {
	if (error instanceof AppError) {
		errorLogger.logError(error, context);
		return error;
	}

	if (error instanceof Error) {
		// Check if it's an HttpError from our API client
		if (error instanceof HttpError) {
			const apiError = new ApiError(error.message, error.status, error.body, context, error);
			errorLogger.logError(apiError, context);
			return apiError;
		}

		// Regular error
		const regularError = new AppError(error.message, undefined, context, error);
		errorLogger.logError(regularError, context);
		return regularError;
	}

	// Handle non-error cases
	const genericError = new AppError('An unknown error occurred', 'UNKNOWN_ERROR', context);
	errorLogger.logError(genericError, context);
	return genericError;
}

/**
 * Handle network errors
 */
export function handleNetworkError(error: unknown, context?: ErrorContext): NetworkError {
	const networkError = new NetworkError(
		error instanceof Error ? error.message : 'Network error occurred',
		context,
		error instanceof Error ? error : undefined
	);
	errorLogger.logError(networkError, context);
	return networkError;
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
	if (error instanceof ApiError) {
		// For API errors, return the specific message
		return error.message;
	}

	if (error instanceof ValidationError) {
		// For validation errors, return the specific field message
		return error.message;
	}

	if (error instanceof NetworkError) {
		// For network errors, provide a user-friendly message
		return 'Network error. Please check your connection and try again.';
	}

	if (error instanceof Error) {
		// For other errors, return a generic message but log the details
		errorLogger.logError(error);
		return 'An error occurred. Please try again.';
	}

	// For non-error values
	return 'An unexpected error occurred.';
}

/**
 * Create a standardized error handler for API calls
 */
export function createApiErrorHandler(context?: ErrorContext) {
	return function (error: unknown): never {
		const handledError = handleApiError(error, context);
		throw handledError;
	};
}

/**
 * Validate and handle note data for editing
 */
export function validateNoteData(title: string, content: string, context?: ErrorContext): void {
	if (!title || typeof title !== 'string') {
		const error = new ValidationError('Title is required', 'title', context);
		errorLogger.logError(error, context);
		throw error;
	}

	if (!content || typeof content !== 'string') {
		const error = new ValidationError('Content is required', 'content', context);
		errorLogger.logError(error, context);
		throw error;
	}

	// Additional validation could be added here
	errorLogger.logDebug('Note data validation passed', context);
}
