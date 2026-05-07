import { describe, expect, it } from 'vitest';
import { clearFieldError, toggleFlag, updateSanitizedField } from './auth-forms';

describe('auth form helpers', () => {
	it('updates a sanitized field value', () => {
		const form = { email: '', password: '' };
		updateSanitizedField(form, 'email', 'user@example.com');
		expect(form.email).toBe('user@example.com');
	});

	it('clears a field error', () => {
		const errors = { email: 'Required', password: '' };
		clearFieldError(errors, 'email');
		expect(errors.email).toBe('');
	});

	it('toggles a boolean flag', () => {
		expect(toggleFlag(true)).toBe(false);
		expect(toggleFlag(false)).toBe(true);
	});
});
