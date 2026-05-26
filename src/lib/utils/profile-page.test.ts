import { describe, it, expect } from 'vitest';
import { buildUserUpdatePayload, getProfileChangeFlags } from './profile-page';
import type { ProfileFormData } from '$lib/types/auth';

const baseForm: ProfileFormData = {
	username: 'user1',
	email: 'u@example.com',
	colorScheme: 'default',
	currentPassword: 'old',
	newPassword: '',
	confirmNewPassword: ''
};

describe('profile-page', () => {
	it('buildUserUpdatePayload includes only changed fields without current password', () => {
		const flags = getProfileChangeFlags({ ...baseForm, colorScheme: 'dark', currentPassword: '' }, {
			id: 1,
			username: 'user1',
			email: 'u@example.com',
			color_scheme: 'default'
		} as never);
		const payload = buildUserUpdatePayload(
			{ ...baseForm, colorScheme: 'dark', currentPassword: '' },
			flags
		);
		expect(payload.current_password).toBeUndefined();
		expect(payload.color_scheme).toBe('dark');
		expect(payload.username).toBeUndefined();
	});

	it('buildUserUpdatePayload sends current password only when changing password', () => {
		const form = {
			...baseForm,
			newPassword: 'NewSecure1!',
			confirmNewPassword: 'NewSecure1!'
		};
		const flags = getProfileChangeFlags(form, {
			id: 1,
			username: 'user1',
			email: 'u@example.com',
			color_scheme: 'default'
		} as never);
		const payload = buildUserUpdatePayload(form, flags);
		expect(payload.current_password).toBe('old');
		expect(payload.password).toBe('NewSecure1!');
	});
});
