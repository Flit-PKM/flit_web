/**
 * Authentication Utilities
 *
 * Pure utility functions for authentication, validation, and security.
 * All functions are testable and have no side effects.
 */

import type { FormErrors, LoginFormData, RegisterFormData, ProfileFormData } from '../types/auth';
import { errorLogger } from './error-handler';

/**
 * Email validation using RFC 5322 compliant regex
 */
export function isValidEmail(email: string): boolean {
	const emailRegex =
		/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
	return emailRegex.test(email);
}

/**
 * Password strength validation
 * Requires: 8+ chars, uppercase, lowercase, number, special char
 */
export function isValidPassword(password: string): boolean {
	if (password.length < 8) return false;

	const hasUpperCase = /[A-Z]/.test(password);
	const hasLowerCase = /[a-z]/.test(password);
	const hasNumbers = /\d/.test(password);
	const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

	return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
}

/**
 * Get password strength score (0-4)
 */
export function getPasswordStrength(password: string): number {
	if (password.length === 0) return 0;

	let score = 0;

	if (password.length >= 8) score++;
	if (/[A-Z]/.test(password)) score++;
	if (/[a-z]/.test(password)) score++;
	if (/\d/.test(password)) score++;
	if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;

	return Math.min(score, 4);
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
 * Validate login form data
 */
export function validateLoginForm(data: LoginFormData): FormErrors {
	errorLogger.logDebug('Validating login form', { data });
	const errors: FormErrors = {};

	if (!data.email.trim()) {
		errors.email = 'Email is required';
	} else if (!isValidEmail(data.email)) {
		errors.email = 'Please enter a valid email address';
	}

	if (!data.password.trim()) {
		errors.password = 'Password is required';
	}

	errorLogger.logDebug('Login form validation complete', {
		errors,
		isValid: Object.keys(errors).length === 0
	});
	return errors;
}

/**
 * Validate registration form data
 */
export function validateRegisterForm(data: RegisterFormData): FormErrors {
	errorLogger.logDebug('Validating registration form', { data });
	const errors: FormErrors = {};

	if (!data.email.trim()) {
		errors.email = 'Email is required';
	} else if (!isValidEmail(data.email)) {
		errors.email = 'Please enter a valid email address';
	}

	if (!data.password.trim()) {
		errors.password = 'Password is required';
	} else if (!isValidPassword(data.password)) {
		errors.password =
			'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character';
	}

	if (!data.confirmPassword.trim()) {
		errors.confirmPassword = 'Please confirm your password';
	} else if (data.password !== data.confirmPassword) {
		errors.confirmPassword = 'Passwords do not match';
	}

	errorLogger.logDebug('Registration form validation complete', {
		errors,
		isValid: Object.keys(errors).length === 0
	});
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
	errorLogger.logDebug('Validating profile form', { data, originalUser });
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

	// Email validation
	if (!data.email.trim()) {
		errors.email = 'Email is required';
	} else if (!isValidEmail(data.email)) {
		errors.email = 'Please enter a valid email address';
	}

	// Check if username or email changed (requires current password)
	const usernameChanged = originalUser && data.username !== originalUser.username;
	const emailChanged = originalUser && data.email !== originalUser.email;
	const passwordChanging = !!(data.newPassword || data.confirmNewPassword);

	// Require current password for all updates (backend requirement)
	if (!data.currentPassword?.trim()) {
		errors.currentPassword = 'Current password is required to update your profile';
	}

	// Password change validation (only if user is actually changing password)
	if (passwordChanging) {
		if (!data.newPassword?.trim()) {
			errors.newPassword = 'New password is required';
		} else if (!isValidPassword(data.newPassword)) {
			errors.newPassword =
				'New password must be at least 8 characters and contain uppercase, lowercase, number, and special character';
		}

		if (!data.confirmNewPassword?.trim()) {
			errors.confirmNewPassword = 'Please confirm your new password';
		} else if (data.newPassword !== data.confirmNewPassword) {
			errors.confirmNewPassword = 'New passwords do not match';
		}
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
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
	return input
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;');
}

/**
 * JWT token validation (basic structure check)
 */
export function isValidJwtToken(token: string): boolean {
	if (!token || typeof token !== 'string') return false;

	const parts = token.split('.');
	if (parts.length !== 3) return false;

	try {
		// Check if header and payload are valid base64
		atob(parts[0]);
		atob(parts[1]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Extract user ID from JWT token (if available)
 * Note: This is a basic implementation. In production, use a proper JWT library.
 */
export function extractUserIdFromToken(token: string): number | null {
	if (!isValidJwtToken(token)) return null;

	try {
		const payload = token.split('.')[1];
		const decoded = JSON.parse(atob(payload));

		// Check if token is expired
		if (decoded.exp && decoded.exp * 1000 < Date.now()) {
			return null;
		}

		return decoded.sub || decoded.user_id || decoded.id || null;
	} catch {
		return null;
	}
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
	if (!isValidJwtToken(token)) return true;

	try {
		const payload = token.split('.')[1];
		const decoded = JSON.parse(atob(payload));

		if (!decoded.exp) return false; // No expiration claim

		return decoded.exp * 1000 < Date.now();
	} catch {
		return true;
	}
}

/**
 * Generate a secure random string for CSRF tokens or state parameters
 */
export function generateSecureRandomString(length: number = 32): string {
	if (typeof crypto === 'undefined') {
		// Fallback for server-side rendering
		return Array.from({ length }, () => Math.random().toString(36)[2]).join('');
	}

	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Rate limiting helper for login attempts
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

	isAllowed(identifier: string): boolean {
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
