<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, currentUser, isAuthenticated } from '$lib/stores/auth';
	import { pendingColorScheme } from '$lib/stores/theme';
	import { apiClient } from '$lib/api/client';
	import {
		validateProfileForm,
		sanitizeInput,
		getPasswordStrength,
		getPasswordStrengthLabel
	} from '$lib/utils/auth';
	import { FormValidator, createDebouncedValidator } from '$lib/utils/validation';
	import { errorLogger, captureApiError } from '$lib/utils/error-handler';
	import { formatProfileDate } from '$lib/utils/profile';
	import { buildUserUpdatePayload, getProfileChangeFlags } from '$lib/utils/profile-page';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import NotesImportExportSection from '$lib/components/profile/NotesImportExportSection.svelte';
	import ConnectedAppsSection from '$lib/components/profile/ConnectedAppsSection.svelte';
	import SubscriptionStatusSection from '$lib/components/profile/SubscriptionStatusSection.svelte';
	import CurrentPasswordInput from '$lib/components/CurrentPasswordInput.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { ProfileFormData, FormErrors } from '$lib/types/auth';
	// State
	let isLoading = $state(true);
	let isSaving = $state(false);
	let showPasswordChange = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);
	let successMessage = $state('');
	let generalError = $state('');

	// Verify email state
	let verifyEmailLoading = $state(false);
	let verifyEmailSuccess = $state('');
	let verifyEmailError = $state('');

	// Feedback state
	let feedbackContent = $state('');
	let feedbackSubmitting = $state(false);
	let feedbackError = $state('');
	let feedbackSuccess = $state('');

	// Form data
	let formData: ProfileFormData = $state({
		username: '',
		email: '',
		colorScheme: 'default',
		currentPassword: '',
		newPassword: '',
		confirmNewPassword: ''
	});

	let errors: FormErrors = $state({});
	let newPasswordStrength = $state(0);
	let newPasswordStrengthLabel = $state('Very Weak');

	const validator = new FormValidator<ProfileFormData>({
		username: { required: true, rules: [] },
		email: { required: true, rules: [] },
		currentPassword: { required: false },
		newPassword: { required: false },
		confirmNewPassword: { required: false }
	});
	const debouncedValidator = createDebouncedValidator(validator);

	// Update password strength when new password changes
	$effect(() => {
		if (formData.newPassword) {
			newPasswordStrength = getPasswordStrength(formData.newPassword);
			newPasswordStrengthLabel = getPasswordStrengthLabel(newPasswordStrength);
		} else {
			newPasswordStrength = 0;
			newPasswordStrengthLabel = 'Very Weak';
		}
	});

	// Apply color scheme immediately on profile (unsaved preview); clear when leaving or after save
	$effect(() => {
		if ($page.url.pathname !== '/profile') return;
		pendingColorScheme.set(formData.colorScheme);
		return () => pendingColorScheme.set(null);
	});

	// Load user data on mount
	onMount(async () => {
		if (!$isAuthenticated) {
			isLoading = false;
			return;
		}

		try {
			// Refresh user data from API
			try {
				await authActions.refreshUser();
			} catch (error) {
				errorLogger.logWarning('Failed to refresh user data, using existing data', {
					component: 'Profile',
					operation: 'refreshUser',
					error
				});
				// Don't block the page if refresh fails - allow form to work with existing data
				generalError = 'Could not refresh user data. You can still update your profile.';
			}

			// Initialize form with current user data
			if ($currentUser) {
				formData.username = $currentUser.username || '';
				formData.email = $currentUser.email;
				formData.colorScheme = $currentUser.color_scheme || 'default';
			}
		} catch (error) {
			generalError = captureApiError(error, {
				component: 'Profile',
				operation: 'loadProfileData'
			});
		} finally {
			isLoading = false;
		}
	});

	// Handle form field changes with validation
	function handleFieldChange(field: keyof ProfileFormData, value: string) {
		formData[field] = sanitizeInput(value);
		errors[field] = '';

		// Debounced validation for real-time feedback
		debouncedValidator.validateField(field as string, value, (error) => {
			errors[field] = error || '';
		});
	}

	// Handle form submission
	async function handleSubmit(event: Event) {
		event.preventDefault();
		generalError = '';
		successMessage = '';
		isSaving = true;

		const flags = getProfileChangeFlags(formData, $currentUser);
		const { hasUsernameChange, hasEmailChange, hasColorSchemeChange, isChangingPassword } = flags;

		if (isChangingPassword) {
			formData.currentPassword = formData.currentPassword || '';
			formData.newPassword = formData.newPassword || '';
			formData.confirmNewPassword = formData.confirmNewPassword || '';
		}

		// Validate form (pass original user for change detection)
		const validationErrors = validateProfileForm(formData, $currentUser || undefined);
		if (Object.keys(validationErrors).length > 0) {
			errors = validationErrors;
			isSaving = false;
			return;
		}
		errorLogger.logDebug('Profile update validated', {
			component: 'Profile',
			operation: 'handleSubmit',
			hasUsernameChange,
			hasEmailChange,
			hasColorSchemeChange,
			isChangingPassword
		});

		try {
			const updateData = buildUserUpdatePayload(formData, flags);
			const updatedUser = await apiClient.updateCurrentUser(updateData);

			// Update the auth store with new user data
			authActions.updateUser(updatedUser);
			pendingColorScheme.set(null);

			// Reset password fields
			formData.currentPassword = '';
			formData.newPassword = '';
			formData.confirmNewPassword = '';
			showPasswordChange = false;

			successMessage = 'Profile updated successfully!';
			errorLogger.logInfo('Profile update completed successfully', {
				component: 'Profile',
				operation: 'updateProfile'
			});
		} catch (error) {
			generalError = captureApiError(error, {
				component: 'Profile',
				operation: 'updateProfile'
			});
		} finally {
			isSaving = false;
		}
	}

	// Toggle password change section
	function togglePasswordChange() {
		showPasswordChange = !showPasswordChange;
		if (!showPasswordChange) {
			// Clear password fields when hiding
			formData.currentPassword = '';
			formData.newPassword = '';
			formData.confirmNewPassword = '';
			errors.currentPassword = '';
			errors.newPassword = '';
			errors.confirmNewPassword = '';
		}
	}

	// Handle logout
	function handleLogout() {
		authActions.logout();
	}

	async function handleVerifyEmail() {
		verifyEmailSuccess = '';
		verifyEmailError = '';
		verifyEmailLoading = true;
		try {
			const res = await apiClient.sendVerificationEmail();
			if (res.sent) {
				verifyEmailSuccess = 'Verification email sent. Check your inbox.';
				setTimeout(() => (verifyEmailSuccess = ''), 4000);
			} else {
				verifyEmailError = res.detail || 'Failed to send verification email.';
			}
		} catch (err) {
			verifyEmailError = captureApiError(err, {
				component: 'Profile',
				operation: 'sendVerificationEmail'
			});
		} finally {
			verifyEmailLoading = false;
		}
	}

	async function handleSubmitFeedback(event?: Event) {
		event?.preventDefault();
		const content = feedbackContent.trim();
		if (!content) return;
		feedbackError = '';
		feedbackSuccess = '';
		feedbackSubmitting = true;
		try {
			const context: Record<string, unknown> = {
				platform: 'web',
				page: 'profile'
			};
			await apiClient.submitFeedback({ content, context });
			feedbackContent = '';
			feedbackSuccess = 'Thank you for your feedback!';
			setTimeout(() => (feedbackSuccess = ''), 4000);
		} catch (err) {
			feedbackError = captureApiError(err, {
				component: 'Profile',
				operation: 'submitFeedback'
			});
		} finally {
			feedbackSubmitting = false;
		}
	}
</script>

<SeoHead
	title="Profile - Flit Web"
	description="Manage your Flit Web account profile and knowledge graph access."
/>

<h1>Your Profile</h1>

{#if isLoading}
	<div class="loading">
		<span class="loading__spinner" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle
					class="loading__spinner-inner"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				></circle>
				<path
					class="loading__spinner-path"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		</span>
		<span>Loading your profile...</span>
	</div>
{:else if $currentUser}
	<div class="page-subhead card__row card__row--between">
		<p class="card__meta">Manage your account information</p>
		<div class="card__row">
			<a href={resolve('/billing')} class="btn btn-secondary">Billing</a>
			<button onclick={handleLogout} class="btn">
				<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
					/>
				</svg>
				Sign out
			</button>
		</div>
	</div>

	<div class="profile-stack">
		{#if successMessage}
			<div class="alert alert--success" role="alert">
				<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="alert__message">{successMessage}</p>
			</div>
		{/if}

		<!-- Profile Form -->
		<div>
			<form class="card" onsubmit={handleSubmit} novalidate>
				<!-- Account Information Section -->
				<h2>Account Information</h2>
				<div class="card__column">
					<!-- Username Field -->
					<div class="card__row card__row--start">
						<label for="username" class="label-inline-end"> Username </label>
						<input
							id="username"
							name="username"
							type="text"
							required
							disabled={isSaving}
							class="input"
							class:input--error={!!errors.username}
							bind:value={formData.username}
							oninput={(e) => handleFieldChange('username', e.currentTarget.value)}
							aria-describedby={errors.username ? 'username-error' : undefined}
							aria-invalid={!!errors.username}
						/>
						{#if errors.username}
							<p id="username-error" class="form-group__error" role="alert">
								{errors.username}
							</p>
						{/if}
					</div>

					<!-- Email Field -->
					<div class="card__row card__row--start">
						<label for="email" class="label-inline-end"> Email address </label>
						<input
							id="email"
							name="email"
							type="email"
							required
							disabled={isSaving}
							class="input"
							class:input--error={!!errors.email}
							bind:value={formData.email}
							oninput={(e) => handleFieldChange('email', e.currentTarget.value)}
							aria-describedby={errors.email ? 'email-error' : undefined}
							aria-invalid={!!errors.email}
						/>
						{#if errors.email}
							<p id="email-error" class="form-group__error" role="alert">
								{errors.email}
							</p>
						{/if}
					</div>

					<!-- Color Scheme Preference -->
					<div class="card__column">
						<span class="card__label">Color scheme</span>
						<p class="card__meta">Choose your preferred color scheme for the interface</p>
						<div class="color-scheme-picker">
							<label
								class="radio-card radio-card--light-preview"
								class:radio-card--selected={formData.colorScheme === 'light'}
								for="color-scheme-light"
							>
								<input
									id="color-scheme-light"
									type="radio"
									name="colorScheme"
									value="light"
									bind:group={formData.colorScheme}
									disabled={isSaving}
								/>
								<div class="radio-card__content">
									<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
										/>
									</svg>
									<span class="radio-card__title">Light</span>
									<p class="muted">Bright and clear</p>
								</div>
							</label>
							<label
								class="radio-card radio-card--dark-preview"
								class:radio-card--selected={formData.colorScheme === 'dark'}
								for="color-scheme-dark"
							>
								<input
									id="color-scheme-dark"
									type="radio"
									name="colorScheme"
									value="dark"
									bind:group={formData.colorScheme}
									disabled={isSaving}
								/>
								<div class="radio-card__content">
									<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
										/>
									</svg>
									<span class="radio-card__title">Dark</span>
									<p class="muted">Easy on the eyes</p>
								</div>
							</label>
							<label
								class="radio-card radio-card--auto-preview"
								class:radio-card--selected={formData.colorScheme === 'default'}
								for="color-scheme-default"
							>
								<input
									id="color-scheme-default"
									type="radio"
									name="colorScheme"
									value="default"
									bind:group={formData.colorScheme}
									disabled={isSaving}
								/>
								<div class="radio-card__content">
									<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
									<span class="radio-card__title">Auto</span>
									<p class="muted">Follow system</p>
								</div>
							</label>
						</div>
					</div>

					<!-- Account Status (entitlement: subscription or access-code grant) -->
					<div class="card__column">
						<div>
							<span class="card__label--muted"> Account Status </span>
							<div>
								<span
									class="badge {($currentUser?.entitlement_active ?? false)
										? 'badge--positive'
										: 'badge--negative'}"
									role="status"
									aria-label="Account status"
								>
									{($currentUser?.entitlement_active ?? false) ? 'Active' : 'Inactive'}
								</span>
							</div>
						</div>
						<div>
							<span class="card__label--muted"> Email Verified </span>
							<div class="card__row flex-start">
								<span
									class="badge {$currentUser.is_verified ? 'badge--positive' : 'badge--muted'}"
									role="status"
									aria-label="Email verification status"
								>
									{$currentUser.is_verified ? 'Verified' : 'Unverified'}
								</span>
								{#if !$currentUser.is_verified}
									<button
										type="button"
										onclick={handleVerifyEmail}
										disabled={verifyEmailLoading}
										class="btn btn--compact"
										aria-label="Send verification email"
									>
										{#if verifyEmailLoading}
											<span class="loading__spinner loading__spinner--mr-sm" aria-hidden="true">
												<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
													<circle
														class="loading__spinner-inner"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														stroke-width="4"
													></circle>
													<path
														class="loading__spinner-path"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path>
												</svg>
											</span>
											Sending…
										{:else}
											Verify Email
										{/if}
									</button>
								{/if}
								{#if verifyEmailSuccess}
									<span class="card__label text-positive mt-xs" role="status">
										{verifyEmailSuccess}
									</span>
								{/if}
								{#if verifyEmailError}
									<span class="form-group__error mt-xs" role="alert">
										{verifyEmailError}
									</span>
								{/if}
							</div>
						</div>
						<SubscriptionStatusSection />
					</div>

					<!-- Account Dates -->
					<div>
						<div>
							<span class="card__label--muted"> Member Since: </span>
							<span class="card__meta" aria-label="Account creation date">
								{formatProfileDate($currentUser.created_at)}
							</span>
						</div>
						<div>
							<span class="card__label--muted"> Last Updated: </span>
							<span class="card__meta" aria-label="Account last updated date">
								{formatProfileDate($currentUser.updated_at)}
							</span>
						</div>
					</div>
				</div>

				<!-- Password Change Section -->
				<div class="card__column">
					<div class="card__row">
						<h2>Change Password</h2>
						<button type="button" onclick={togglePasswordChange} class="btn">
							{showPasswordChange ? 'Cancel' : 'Change password'}
						</button>
					</div>

					{#if showPasswordChange}
						<CurrentPasswordInput
							id="currentPassword"
							name="currentPassword"
							value={formData.currentPassword}
							oninput={(v) => handleFieldChange('currentPassword', v)}
							error={errors.currentPassword}
							disabled={isSaving}
							bind:showPassword={showCurrentPassword}
							errorId="current-password-error"
						/>

						<!-- New Password -->
						<div class="card__row">
							<label for="newPassword"> New password </label>
							<div>
								<input
									id="newPassword"
									name="newPassword"
									type={showNewPassword ? 'text' : 'password'}
									disabled={isSaving}
									class="input"
									class:input--error={!!errors.newPassword}
									placeholder="Enter new password"
									bind:value={formData.newPassword}
									oninput={(e) => handleFieldChange('newPassword', e.currentTarget.value)}
									aria-describedby={errors.newPassword ? 'new-password-error' : 'password-strength'}
									aria-invalid={!!errors.newPassword}
								/>
								<button
									type="button"
									class="input__action"
									onclick={() => (showNewPassword = !showNewPassword)}
									disabled={isSaving}
									aria-label={showNewPassword ? 'Hide password' : 'Show password'}
								>
									{#if showNewPassword}
										<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.05 8.05m1.829 1.829l4.242 4.242M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.563 3.029m-5.858-.908a3 3 0 01-4.243-4.243"
											/>
										</svg>
									{:else}
										<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
											/>
										</svg>
									{/if}
								</button>
							</div>

							<!-- Password Strength Indicator -->
							{#if formData.newPassword}
								{@const level = Math.min(4, Math.max(0, newPasswordStrength))}
								<div class="strength-bar">
									<div class="strength-bar__track">
										<div
											class="strength-bar__fill strength-bar__fill--{level}"
											style="width: {(level / 4) * 100}%"
										></div>
									</div>
									<span class="strength-bar__label strength-bar__label--{level}">
										{newPasswordStrengthLabel}
									</span>
								</div>
								<p id="password-strength" class="form-group__hint">
									Use at least 8 characters with uppercase, lowercase, number, and special
									character.
								</p>
							{/if}

							{#if errors.newPassword}
								<p id="new-password-error" class="form-group__error" role="alert">
									{errors.newPassword}
								</p>
							{/if}
						</div>

						<!-- Confirm New Password -->
						<div class="card__row">
							<label for="confirmNewPassword"> Confirm new password </label>
							<div>
								<input
									id="confirmNewPassword"
									name="confirmNewPassword"
									type={showConfirmPassword ? 'text' : 'password'}
									disabled={isSaving}
									class="input"
									class:input--error={!!errors.confirmNewPassword}
									placeholder="Confirm new password"
									bind:value={formData.confirmNewPassword}
									oninput={(e) => handleFieldChange('confirmNewPassword', e.currentTarget.value)}
									aria-describedby={errors.confirmNewPassword
										? 'confirm-new-password-error'
										: undefined}
									aria-invalid={!!errors.confirmNewPassword}
								/>
								<button
									type="button"
									class="input__action"
									onclick={() => (showConfirmPassword = !showConfirmPassword)}
									disabled={isSaving}
									aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
								>
									{#if showConfirmPassword}
										<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.05 8.05m1.829 1.829l4.242 4.242M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.563 3.029m-5.858-.908a3 3 0 01-4.243-4.243"
											/>
										</svg>
									{:else}
										<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
											/>
										</svg>
									{/if}
								</button>
							</div>
							{#if errors.confirmNewPassword}
								<p id="confirm-new-password-error" class="form-group__error" role="alert">
									{errors.confirmNewPassword}
								</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- General Error -->
				<GeneralErrorAlert message={generalError} />

				<!-- Submit Button -->
				<div class="card__row">
					<button type="submit" disabled={isSaving} class="btn btn-primary">
						{#if isSaving}
							<span class="loading__spinner loading__spinner--mr-md" aria-hidden="true">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle
										class="loading__spinner-inner"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="loading__spinner-path"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
							</span>
							Saving...
						{:else}
							Save Changes
						{/if}
					</button>
				</div>
			</form>
		</div>

		<ConnectedAppsSection />

		<NotesImportExportSection />

		<!-- Feedback -->
		<div class="card">
			<h2>Feedback</h2>
			<p class="card__meta">
				Share your love, hate and everything in between! Your feedback helps us improve.
			</p>
			{#if feedbackError}
				<div class="alert alert--error" role="alert">
					<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="alert__message">{feedbackError}</p>
				</div>
			{/if}
			{#if feedbackSuccess}
				<div class="alert alert--success alert--mb-md" role="alert">
					<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="alert__message">{feedbackSuccess}</p>
				</div>
			{/if}
			<div class="card__column">
				<div class="form-group">
					<label for="feedback-content">Message</label>
					<textarea
						id="feedback-content"
						placeholder="Share your thoughts…"
						bind:value={feedbackContent}
						disabled={feedbackSubmitting}
						rows="5"
						class="input wide textarea-resize-y"
					></textarea>
				</div>
				<div class="card__row">
					<button
						type="button"
						class="btn btn-primary"
						disabled={feedbackSubmitting || !feedbackContent.trim()}
						onclick={handleSubmitFeedback}
					>
						{#if feedbackSubmitting}
							Submitting…
						{:else}
							Submit feedback
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Not authenticated -->
	<h2>Access Denied</h2>
	<div class="card">
		<p>You need to sign in to access your profile.</p>
		<div class="card__row">
			<a href={resolve('/login')} class="btn btn-primary">Sign In</a>
		</div>
	</div>
{/if}
