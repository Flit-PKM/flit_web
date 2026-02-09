import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	handleApiError,
	formatErrorForUser,
	captureApiError,
	AppError,
	ApiError,
	ValidationError,
	NetworkError
} from './error-handler';
import { HttpError } from '$lib/api/client';

describe('handleApiError', () => {
	beforeEach(() => {
		vi.stubGlobal('console', { ...console, error: vi.fn(), debug: vi.fn() });
	});

	it('returns same error if already AppError', () => {
		const err = new AppError('test');
		expect(handleApiError(err)).toBe(err);
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
		vi.stubGlobal('console', { ...console, error: vi.fn(), debug: vi.fn() });
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
