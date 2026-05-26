import type { ProfileFormData, UserUpdate } from '$lib/types/auth';
import type { User } from '$lib/types/auth';

export type ProfileChangeFlags = {
	hasUsernameChange: boolean;
	hasEmailChange: boolean;
	hasColorSchemeChange: boolean;
	isChangingPassword: boolean;
};

export function getProfileChangeFlags(
	formData: ProfileFormData,
	currentUser: User | null
): ProfileChangeFlags {
	return {
		hasUsernameChange: !!currentUser && formData.username !== currentUser.username,
		hasEmailChange: !!currentUser && formData.email !== currentUser.email,
		hasColorSchemeChange:
			!!currentUser && formData.colorScheme !== (currentUser.color_scheme || 'default'),
		isChangingPassword: !!(formData.newPassword || formData.confirmNewPassword)
	};
}

export function buildUserUpdatePayload(
	formData: ProfileFormData,
	flags: ProfileChangeFlags
): UserUpdate {
	const updateData: UserUpdate = {};
	if (flags.hasUsernameChange) updateData.username = formData.username;
	if (flags.hasEmailChange) updateData.email = formData.email;
	if (flags.hasColorSchemeChange) updateData.color_scheme = formData.colorScheme;
	if (flags.isChangingPassword && formData.newPassword) {
		updateData.current_password = formData.currentPassword;
		updateData.password = formData.newPassword;
	}
	return updateData;
}
