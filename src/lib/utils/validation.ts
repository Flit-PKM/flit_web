/**
 * Form Validation System
 *
 * Reactive form validation with proper error handling and user feedback.
 * Provides consistent validation across all forms in the application.
 */

import type { FormErrors } from '../types/auth';

/**
 * Validation rule function type
 */
export type ValidationRule<T = string> = (value: T) => string | null;

/**
 * Field validation configuration
 */
export interface FieldValidation<T = string> {
	required?: boolean;
	rules?: ValidationRule<T>[];
	customMessage?: string;
}

/**
 * Form validation configuration
 */
export interface FormValidationConfig {
	[key: string]: FieldValidation<unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
	isValid: boolean;
	errors: FormErrors;
	firstError?: string;
}

/**
 * Common validation rules
 */
export const validationRules = {
	required:
		(message: string = 'This field is required'): ValidationRule =>
		(value: string) =>
			!value || value.trim() === '' ? message : null,

	minLength:
		(min: number, message?: string): ValidationRule =>
		(value: string) =>
			value.length < min ? message || `Must be at least ${min} characters` : null,

	maxLength:
		(max: number, message?: string): ValidationRule =>
		(value: string) =>
			value.length > max ? message || `Must be no more than ${max} characters` : null,

	email:
		(message: string = 'Please enter a valid email address'): ValidationRule =>
		(value: string) => {
			const emailRegex =
				/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
			return !emailRegex.test(value) ? message : null;
		},

	password:
		(
			message: string = 'Password must contain uppercase, lowercase, number, and special character'
		): ValidationRule =>
		(value: string) => {
			const hasUpperCase = /[A-Z]/.test(value);
			const hasLowerCase = /[a-z]/.test(value);
			const hasNumbers = /\d/.test(value);
			const hasSpecialChar = /[!@#$%^&*()_+\-=[[\]{};':"\\|,.<>/?]/.test(value);
			return !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar ? message : null;
		},

	match:
		(otherValue: string, message: string = 'Values do not match'): ValidationRule =>
		(value: string) =>
			value !== otherValue ? message : null,

	pattern:
		(regex: RegExp, message: string = 'Invalid format'): ValidationRule =>
		(value: string) =>
			!regex.test(value) ? message : null,

	custom:
		(validator: (value: string) => boolean, message: string): ValidationRule =>
		(value: string) =>
			!validator(value) ? message : null
};

/**
 * Validate a single field
 */
export function validateField<T = string>(value: T, validation: FieldValidation<T>): string | null {
	// Check required first
	if (validation.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
		return validation.customMessage || 'This field is required';
	}

	// Skip other validations if value is empty and not required
	if (!value || (typeof value === 'string' && value.trim() === '')) {
		return null;
	}

	// Run validation rules
	if (validation.rules) {
		for (const rule of validation.rules) {
			const error = rule(value);
			if (error) {
				return validation.customMessage || error;
			}
		}
	}

	return null;
}

/**
 * Validate an entire form
 */
export function validateForm<T extends Record<string, unknown>>(
	data: T,
	config: FormValidationConfig
): ValidationResult {
	const errors: FormErrors = {};
	let firstError: string | undefined;

	for (const [field, validation] of Object.entries(config)) {
		const value = data[field];
		const error = validateField(value, validation);

		if (error) {
			errors[field] = error;
			if (!firstError) {
				firstError = error;
			}
		}
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
		firstError
	};
}

/**
 * Create a reactive form validator
 */
export class FormValidator<T extends Record<string, unknown>> {
	private config: FormValidationConfig;
	private errors: FormErrors = {};

	constructor(config: FormValidationConfig) {
		this.config = config;
	}

	/**
	 * Validate entire form
	 */
	validate(data: T): ValidationResult {
		const result = validateForm(data, this.config);
		this.errors = result.errors;
		return result;
	}

	/**
	 * Validate single field
	 */
	validateField(field: string, value: unknown): string | null {
		const validation = this.config[field];
		if (!validation) return null;

		const error = validateField(value, validation);
		if (error) {
			this.errors[field] = error;
		} else {
			delete this.errors[field];
		}

		return error;
	}

	/**
	 * Get current errors
	 */
	getErrors(): FormErrors {
		return { ...this.errors };
	}

	/**
	 * Clear all errors
	 */
	clearErrors(): void {
		this.errors = {};
	}

	/**
	 * Clear error for specific field
	 */
	clearFieldError(field: string): void {
		delete this.errors[field];
	}

	/**
	 * Check if form has any errors
	 */
	hasErrors(): boolean {
		return Object.keys(this.errors).length > 0;
	}

	/**
	 * Get first error message
	 */
	getFirstError(): string | undefined {
		const errorKeys = Object.keys(this.errors);
		return errorKeys.length > 0 ? this.errors[errorKeys[0]] : undefined;
	}
}

/**
 * Debounced validation for real-time feedback
 */
export function createDebouncedValidator<T extends Record<string, unknown>>(
	validator: FormValidator<T>,
	delay: number = 300
) {
	let timeoutId: number | null = null;

	return {
		validateField: (field: string, value: unknown, callback?: (error: string | null) => void) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			timeoutId = window.setTimeout(() => {
				const error = validator.validateField(field, value);
				callback?.(error);
				timeoutId = null;
			}, delay);
		},

		cancel: () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		}
	};
}

/**
 * Accessibility helper for form fields
 */
export function getFieldAccessibilityProps(
	fieldName: string,
	error: string | null,
	describedBy?: string
) {
	const props: Record<string, unknown> = {
		'aria-invalid': !!error,
		'aria-describedby': error ? `${fieldName}-error` : describedBy || undefined
	};

	return props;
}

/**
 * Form submission helper with validation
 */
export async function submitFormWithValidation<T extends Record<string, unknown>>(
	data: T,
	validator: FormValidator<T>,
	submitFn: (data: T) => Promise<unknown>
): Promise<{ success: boolean; error?: string; data?: unknown }> {
	const validation = validator.validate(data);

	if (!validation.isValid) {
		return {
			success: false,
			error: validation.firstError || 'Please fix the form errors'
		};
	}

	try {
		const result = await submitFn(data);
		return { success: true, data: result };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Submission failed';
		return { success: false, error: errorMessage };
	}
}
