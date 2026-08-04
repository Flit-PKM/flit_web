/**
 * Authentication Utilities
 *
 * Pure utility functions for authentication, validation, and security.
 * All functions are testable and have no side effects.
 */

import type { FormErrors, LoginFormData, RegisterFormData, ProfileFormData } from '../types/auth';
import { errorLogger } from './error-handler';
import { passwordMeetsComplexity, validateField, validationRules } from './validation';

/**
 * Email validation (delegates to validation.ts)
 */
export function isValidEmail(email: string): boolean {
	return validateField(email, { required: true, rules: [validationRules.email()] }) === null;
}

/**
 * Password strength validation: 8+ chars, uppercase, lowercase, number, special char.
 * Delegates to validation.ts.
 */
export function isValidPassword(password: string): boolean {
	return (
		validateField(password, {
			required: true,
			rules: [validationRules.minLength(8), validationRules.password()]
		}) === null
	);
}

/**
 * Get password strength score (0-4) aligned with validationRules.password.
 * 0 empty, 1 short (<8), 2 length ok but missing complexity, 3 complex <12 chars, 4 complex 12+.
 */
export function getPasswordStrength(password: string): number {
	if (password.length === 0) return 0;
	if (password.length < 8) return 1;
	if (!passwordMeetsComplexity(password)) return 2;
	if (password.length < 12) return 3;
	return 4;
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(strength: number): string {
	switch (strength) {
		case 0:
			return 'Very Weak';
		case 1:
			return 'Weak';
		case 2:
			return 'Fair';
		case 3:
			return 'Good';
		case 4:
			return 'Strong';
		default:
			return 'Unknown';
	}
}

/**
 * Validate login form data (uses validation.ts rules)
 */
export function validateLoginForm(data: LoginFormData): FormErrors {
	errorLogger.logDebug('Validating login form', { hasEmail: Boolean(data.email) });
	const errors: FormErrors = {};
	const emailErr = validateField(data.email, { required: true, rules: [validationRules.email()] });
	if (emailErr) errors.email = emailErr;
	const passwordErr = validateField(data.password, { required: true });
	if (passwordErr) errors.password = passwordErr;
	errorLogger.logDebug('Login form validation complete', {
		errors,
		isValid: Object.keys(errors).length === 0
	});
	return errors;
}

/**
 * Validate registration form data (uses validation.ts rules)
 */
export function validateRegisterForm(data: RegisterFormData): FormErrors {
	errorLogger.logDebug('Validating registration form', { hasEmail: Boolean(data.email) });
	const errors: FormErrors = {};
	const emailErr = validateField(data.email, { required: true, rules: [validationRules.email()] });
	if (emailErr) errors.email = emailErr;
	const passwordErr = validateField(data.password, {
		required: true,
		rules: [validationRules.minLength(8), validationRules.password()]
	});
	if (passwordErr) errors.password = passwordErr;
	const confirmErr = validateField(data.confirmPassword, {
		required: true,
		rules: [validationRules.match(data.password, 'Passwords do not match')]
	});
	if (confirmErr) errors.confirmPassword = confirmErr;
	errorLogger.logDebug('Registration form validation complete', {
		errors,
		isValid: Object.keys(errors).length === 0
	});
	return errors;
}

/**
 * Validate forgot password form (email only).
 */
export function validateForgotPasswordForm(data: { email: string }): FormErrors {
	const errors: FormErrors = {};
	const emailErr = validateField(data.email, { required: true, rules: [validationRules.email()] });
	if (emailErr) errors.email = emailErr;
	return errors;
}

/**
 * Validate reset password form (new password min 8 chars, confirmation must match if provided).
 */
export function validateResetPasswordForm(data: {
	newPassword: string;
	confirmPassword?: string;
}): FormErrors {
	const errors: FormErrors = {};
	const newPasswordErr = validateField(data.newPassword, {
		required: true,
		rules: [validationRules.minLength(8), validationRules.password()]
	});
	if (newPasswordErr) errors.newPassword = newPasswordErr;
	if (data.confirmPassword !== undefined && data.confirmPassword !== '') {
		const confirmErr = validateField(data.confirmPassword, {
			required: true,
			rules: [validationRules.match(data.newPassword, 'Passwords do not match')]
		});
		if (confirmErr) errors.confirmPassword = confirmErr;
	}
	return errors;
}

/**
 * Username validation: 3-50 chars, alphanumeric + underscore/hyphen
 */
export function isValidUsername(username: string): boolean {
	const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
	return usernameRegex.test(username);
}

/**
 * Validate profile update form data
 * @param data - Form data to validate
 * @param originalUser - Original user data to detect changes (optional)
 */
export function validateProfileForm(
	data: ProfileFormData,
	originalUser?: { username?: string; email?: string }
): FormErrors {
	errorLogger.logDebug('Validating profile form', {
		hasUsername: Boolean(data.username),
		hasEmail: Boolean(data.email),
		hasCurrentPassword: Boolean(data.currentPassword),
		hasNewPassword: Boolean(data.newPassword),
		hasConfirmNewPassword: Boolean(data.confirmNewPassword),
		originalUser
	});
	const errors: FormErrors = {};

	// Username validation
	if (!data.username.trim()) {
		errors.username = 'Username is required';
	} else if (data.username.length < 3) {
		errors.username = 'Username must be at least 3 characters';
	} else if (data.username.length > 50) {
		errors.username = 'Username must be at most 50 characters';
	} else if (!isValidUsername(data.username)) {
		errors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
	}

	// Email validation (uses validation.ts)
	const emailErr = validateField(data.email, { required: true, rules: [validationRules.email()] });
	if (emailErr) errors.email = emailErr;

	const passwordChanging = !!(data.newPassword || data.confirmNewPassword);

	// Password change validation (only when setting a new password); uses validation.ts
	if (passwordChanging) {
		if (!data.currentPassword?.trim()) {
			errors.currentPassword = 'Current password is required to change your password';
		}
		const newPasswordErr = validateField(data.newPassword ?? '', {
			required: true,
			rules: [validationRules.minLength(8), validationRules.password()]
		});
		if (newPasswordErr) errors.newPassword = newPasswordErr;
		const confirmNewErr = validateField(data.confirmNewPassword ?? '', {
			required: true,
			rules: [validationRules.match(data.newPassword ?? '', 'New passwords do not match')]
		});
		if (confirmNewErr) errors.confirmNewPassword = confirmNewErr;
	}

	errorLogger.logDebug('Profile form validation complete', {
		errors,
		isValid: Object.keys(errors).length === 0
	});
	return errors;
}

/**
 * Check if form has any validation errors
 */
export function hasFormErrors(errors: FormErrors): boolean {
	return Object.keys(errors).length > 0;
}

/**
 * Preserve user input as-is for form state (especially credentials).
 *
 * @security Do not use for HTML output. Svelte `{text}` bindings auto-escape.
 * The only `{@html}` sinks must go through `markdownToSafeHtml` (DOMPurify) or
 * escaped JSON-LD (`escapeJsonLd`).
 */
export function sanitizeInput(input: string): string {
	return input;
}

/** Decode a JWT base64url segment to a UTF-8 string. */
function decodeJwtSegment(segment: string): string {
	const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	return atob(padded);
}

/** Parse JWT payload object, or null if structure/decode fails. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
	if (!token || typeof token !== 'string') return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	try {
		const decoded = JSON.parse(decodeJwtSegment(parts[1])) as unknown;
		if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
		return decoded as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * JWT token validation (basic structure check)
 */
export function isValidJwtToken(token: string): boolean {
	if (!token || typeof token !== 'string') return false;

	const parts = token.split('.');
	if (parts.length !== 3) return false;

	try {
		decodeJwtSegment(parts[0]);
		decodeJwtSegment(parts[1]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
	const decoded = decodeJwtPayload(token);
	if (!decoded) return true;

	const exp = decoded.exp;
	if (typeof exp !== 'number') return false; // No expiration claim

	return exp * 1000 < Date.now();
}

/**
 * Client-side login attempt pacing (UX only; not a security control).
 * In-memory only — resets on page reload.
 */
export class RateLimiter {
	private attempts: Map<string, number[]> = new Map();
	private maxAttempts: number;
	private windowMs: number;

	constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
		// 15 minutes
		this.maxAttempts = maxAttempts;
		this.windowMs = windowMs;
	}

	/** Drop identifiers with no attempts in the current window. */
	prune(): void {
		const now = Date.now();
		for (const [id, attempts] of this.attempts) {
			const recent = attempts.filter((time) => now - time < this.windowMs);
			if (recent.length === 0) {
				this.attempts.delete(id);
			} else if (recent.length !== attempts.length) {
				this.attempts.set(id, recent);
			}
		}
	}

	isAllowed(identifier: string): boolean {
		this.prune();
		const now = Date.now();
		const attempts = this.attempts.get(identifier) || [];

		// Filter out old attempts outside the window
		const recentAttempts = attempts.filter((time) => now - time < this.windowMs);

		this.attempts.set(identifier, recentAttempts);

		return recentAttempts.length < this.maxAttempts;
	}

	recordAttempt(identifier: string): void {
		const attempts = this.attempts.get(identifier) || [];
		attempts.push(Date.now());
		this.attempts.set(identifier, attempts);
	}

	getRemainingTime(identifier: string): number {
		const attempts = this.attempts.get(identifier) || [];
		if (attempts.length === 0) return 0;

		const oldestAttempt = Math.min(...attempts);
		const timePassed = Date.now() - oldestAttempt;

		return Math.max(0, this.windowMs - timePassed);
	}
}

// Global rate limiter instance
export const loginRateLimiter = new RateLimiter();
