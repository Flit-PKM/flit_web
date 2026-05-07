import { HttpError } from '$lib/api/client';
import { captureApiError } from '$lib/utils/error-handler';

export function getCheckoutErrorMessage(err: unknown): string {
	if (err instanceof HttpError) {
		if (err.status === 503) return 'Billing is temporarily unavailable.';
		if (err.status === 502) return 'Something went wrong. Try again later.';
	}
	return captureApiError(err, {
		component: 'Profile',
		operation: 'createCheckoutSession'
	});
}

export function formatProfileDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
