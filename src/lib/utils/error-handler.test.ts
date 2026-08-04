import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	handleApiError,
	formatErrorForUser,
	captureApiError,
	AppError,
	ApiError,
	ValidationError,
	NetworkError,
	errorLogger
} from './error-handler';
import { HttpError } from '$lib/api/client';

describe('handleApiError', () => {
	beforeEach(() => {
		vi.stubGlobal('console', {
			...console,
			error: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn()
		});
		errorLogger.setLogLevel('error');
	});

	it('returns same error if already AppError', () => {
		const err = new AppError('test');
		expect(handleApiError(err)).toBe(err);
	});

	it('does not re-log already-handled AppError', () => {
		const spy = vi.spyOn(errorLogger, 'logError');
		const err = new AppError('already handled');
		handleApiError(err);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('wraps HttpError in ApiError', () => {
		const httpErr = new HttpError('Not found', 404);
		const result = handleApiError(httpErr);
		expect(result).toBeInstanceOf(ApiError);
		expect((result as ApiError).status).toBe(404);
		expect(result.message).toBe('Not found');
	});

	it('wraps generic Error in AppError', () => {
		const err = new Error('generic');
		const result = handleApiError(err);
		expect(result).toBeInstanceOf(AppError);
		expect(result.message).toBe('generic');
	});

	it('wraps non-Error in generic AppError', () => {
		const result = handleApiError('string error');
		expect(result).toBeInstanceOf(AppError);
		expect(result.message).toBe('An unknown error occurred');
	});
});

describe('formatErrorForUser', () => {
	it('returns message for ApiError', () => {
		const err = new ApiError('Server error', 500);
		expect(formatErrorForUser(err)).toBe('Server error');
	});

	it('returns message for ValidationError', () => {
		const err = new ValidationError('Invalid field', 'email');
		expect(formatErrorForUser(err)).toBe('Invalid field');
	});

	it('returns friendly message for NetworkError', () => {
		const err = new NetworkError('Failed to fetch');
		expect(formatErrorForUser(err)).toContain('Network');
	});

	it('returns generic message for plain Error', () => {
		expect(formatErrorForUser(new Error('technical'))).toBe('An error occurred. Please try again.');
	});

	it('returns fallback for non-Error', () => {
		expect(formatErrorForUser(null)).toBe('An unexpected error occurred.');
	});
});

describe('captureApiError', () => {
	beforeEach(() => {
		vi.stubGlobal('console', {
			...console,
			error: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn()
		});
		errorLogger.setLogLevel('error');
	});

	it('returns user-facing string and logs', () => {
		const err = new Error('fail');
		const msg = captureApiError(err, { component: 'Test', operation: 'run' });
		expect(msg).toBe('An error occurred. Please try again.');
	});

	it('returns ApiError message for HttpError', () => {
		const httpErr = new HttpError('Unauthorized', 401);
		const msg = captureApiError(httpErr);
		expect(msg).toBe('Unauthorized');
	});
});

describe('ErrorLogger log levels', () => {
	beforeEach(() => {
		vi.stubGlobal('console', {
			...console,
			error: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn()
		});
	});

	it('debug level logs debug/info/warn/error', () => {
		errorLogger.setLogLevel('debug');
		errorLogger.logDebug('debug message');
		errorLogger.logInfo('info message');
		errorLogger.logWarning('warn message');
		errorLogger.logError(new Error('error message'));

		expect(console.debug).toHaveBeenCalled();
		expect(console.info).toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});

	it('deploy-like warn level suppresses debug/info', () => {
		errorLogger.setLogLevel('warn');
		errorLogger.logDebug('debug message');
		errorLogger.logInfo('info message');
		errorLogger.logWarning('warn message');
		errorLogger.logError(new Error('error message'));

		expect(console.debug).not.toHaveBeenCalled();
		expect(console.info).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});
});
