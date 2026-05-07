import { sanitizeInput } from '$lib/utils/auth';

export function updateSanitizedField(
	formData: Record<string, unknown>,
	field: string,
	value: string
): void {
	formData[field] = sanitizeInput(value);
}

export function clearFieldError(errors: Record<string, string | undefined>, field: string): void {
	errors[field] = '';
}

export function toggleFlag(current: boolean): boolean {
	return !current;
}
