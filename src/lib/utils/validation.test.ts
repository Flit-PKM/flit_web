import { describe, expect, it } from 'vitest';
import {
	FormValidator,
	submitFormWithValidation,
	validateField,
	validationRules
} from './validation';

describe('validation utils', () => {
	it('validates field with required + rules', () => {
		expect(validateField('', { required: true })).toBe('This field is required');
		expect(validateField('abc', { rules: [validationRules.minLength(4)] })).toContain('at least');
		expect(validateField('abcd', { rules: [validationRules.minLength(4)] })).toBeNull();
	});

	it('FormValidator tracks and clears errors', () => {
		const validator = new FormValidator<{ email: string }>({
			email: {
				required: true,
				rules: [validationRules.email() as (value: unknown) => string | null]
			}
		});
		expect(validator.validateField('email', '')).toBeTruthy();
		expect(validator.hasErrors()).toBe(true);
		validator.clearFieldError('email');
		expect(validator.hasErrors()).toBe(false);
	});

	it('submitFormWithValidation short-circuits on invalid forms', async () => {
		const validator = new FormValidator<{ email: string }>({
			email: {
				required: true,
				rules: [validationRules.email() as (value: unknown) => string | null]
			}
		});
		const result = await submitFormWithValidation({ email: 'bad' }, validator, async () => ({
			ok: true
		}));
		expect(result.success).toBe(false);
	});
});
