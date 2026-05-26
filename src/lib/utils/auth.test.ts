import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	isValidEmail,
	isValidPassword,
	getPasswordStrength,
	getPasswordStrengthLabel,
	validateLoginForm,
	validateRegisterForm,
	validateProfileForm,
	isTokenExpired,
	hasFormErrors,
	RateLimiter
} from './auth';

describe('isValidEmail', () => {
	it('accepts valid email addresses', () => {
		expect(isValidEmail('user@example.com')).toBe(true);
		expect(isValidEmail('test+tag@domain.co.uk')).toBe(true);
		expect(isValidEmail('a@b.co')).toBe(true);
	});

	it('rejects invalid email addresses', () => {
		expect(isValidEmail('')).toBe(false);
		expect(isValidEmail('invalid')).toBe(false);
		expect(isValidEmail('@nodomain.com')).toBe(false);
		expect(isValidEmail('noatsign.com')).toBe(false);
	});
});

describe('isValidPassword', () => {
	it('accepts passwords with 8+ chars, upper, lower, number, special', () => {
		expect(isValidPassword('Abcdef1!')).toBe(true);
		expect(isValidPassword('MyP@ssw0rd')).toBe(true);
	});

	it('rejects short passwords', () => {
		expect(isValidPassword('Abc1!')).toBe(false);
	});

	it('rejects passwords missing character types', () => {
		expect(isValidPassword('abcdefgh')).toBe(false); // no upper, number, special
		expect(isValidPassword('ABCDEFG1!')).toBe(false); // no lower
		expect(isValidPassword('Abcdefgh!')).toBe(false); // no number
	});
});

describe('getPasswordStrength', () => {
	it('returns 0 for empty password', () => {
		expect(getPasswordStrength('')).toBe(0);
	});

	it('scores by length and complexity', () => {
		expect(getPasswordStrength('a')).toBe(1);
		expect(getPasswordStrength('abcdefgh')).toBe(2);
		expect(getPasswordStrength('Abcdef1!')).toBe(3);
		expect(getPasswordStrength('Abcdef1!extra')).toBe(4);
		expect(getPasswordStrength('aaaaaaaa')).toBe(2);
	});
});

describe('getPasswordStrengthLabel', () => {
	it('returns label for each level', () => {
		expect(getPasswordStrengthLabel(0)).toBe('Very Weak');
		expect(getPasswordStrengthLabel(1)).toBe('Weak');
		expect(getPasswordStrengthLabel(2)).toBe('Fair');
		expect(getPasswordStrengthLabel(3)).toBe('Good');
		expect(getPasswordStrengthLabel(4)).toBe('Strong');
		expect(getPasswordStrengthLabel(99)).toBe('Unknown');
	});
});

describe('validateLoginForm', () => {
	beforeEach(() => {
		vi.stubGlobal('console', { ...console, debug: vi.fn() });
	});

	it('returns no errors for valid data', () => {
		const result = validateLoginForm({ email: 'user@example.com', password: 'Secret1!' });
		expect(hasFormErrors(result)).toBe(false);
	});

	it('returns errors for empty email or password', () => {
		expect(validateLoginForm({ email: '', password: 'x' }).email).toBeDefined();
		expect(validateLoginForm({ email: 'a@b.com', password: '' }).password).toBeDefined();
	});

	it('returns error for invalid email format', () => {
		const result = validateLoginForm({ email: 'notanemail', password: 'Abcdef1!' });
		expect(result.email).toBeDefined();
	});
});

describe('validateRegisterForm', () => {
	beforeEach(() => {
		vi.stubGlobal('console', { ...console, debug: vi.fn() });
	});

	it('returns no errors for valid data', () => {
		const result = validateRegisterForm({
			email: 'user@example.com',
			password: 'Abcdef1!',
			confirmPassword: 'Abcdef1!'
		});
		expect(hasFormErrors(result)).toBe(false);
	});

	it('returns error when passwords do not match', () => {
		const result = validateRegisterForm({
			email: 'user@example.com',
			password: 'Abcdef1!',
			confirmPassword: 'Abcdef2!'
		});
		expect(result.confirmPassword).toBeDefined();
	});
});

describe('validateProfileForm', () => {
	beforeEach(() => {
		vi.stubGlobal('console', { ...console, debug: vi.fn() });
	});

	const baseProfile = {
		username: 'user1',
		email: 'u@example.com',
		colorScheme: 'default' as const,
		currentPassword: '',
		newPassword: '',
		confirmNewPassword: ''
	};

	it('does not require current password for account-only updates', () => {
		const result = validateProfileForm({ ...baseProfile, colorScheme: 'dark' });
		expect(result.currentPassword).toBeUndefined();
		expect(hasFormErrors(result)).toBe(false);
	});

	it('requires current password when changing password', () => {
		const result = validateProfileForm({
			...baseProfile,
			newPassword: 'NewSecure1!',
			confirmNewPassword: 'NewSecure1!'
		});
		expect(result.currentPassword).toBe('Current password is required to change your password');
	});
});

describe('RateLimiter', () => {
	it('prune removes stale identifiers', () => {
		const limiter = new RateLimiter(5, 1000);
		limiter.recordAttempt('a@b.com');
		limiter.prune();
		expect(limiter.isAllowed('a@b.com')).toBe(true);
	});
});

describe('isTokenExpired', () => {
	it('returns true for invalid token', () => {
		expect(isTokenExpired('')).toBe(true);
		expect(isTokenExpired('not.jwt')).toBe(true);
	});

	it('returns false for valid unexpired token', () => {
		// header.payload.signature with exp in future
		const payload = btoa(JSON.stringify({ sub: 1, exp: Math.floor(Date.now() / 1000) + 3600 }));
		const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
		expect(isTokenExpired(token)).toBe(false);
	});

	it('returns true for expired token', () => {
		const payload = btoa(JSON.stringify({ sub: 1, exp: Math.floor(Date.now() / 1000) - 3600 }));
		const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
		expect(isTokenExpired(token)).toBe(true);
	});
});
