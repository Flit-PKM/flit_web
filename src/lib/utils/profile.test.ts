import { describe, expect, it } from 'vitest';
import { HttpError } from '$lib/api/client';
import { getCheckoutErrorMessage } from './profile';

describe('getCheckoutErrorMessage', () => {
	it('maps known billing gateway errors to stable messages', () => {
		expect(getCheckoutErrorMessage(new HttpError('Service unavailable', 503))).toBe(
			'Billing is temporarily unavailable.'
		);
		expect(getCheckoutErrorMessage(new HttpError('Bad gateway', 502))).toBe(
			'Something went wrong. Try again later.'
		);
	});
});
