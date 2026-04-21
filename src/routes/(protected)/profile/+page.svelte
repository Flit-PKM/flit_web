<script lang="ts">
	import { onMount } from 'svelte';
	import { base, resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, currentUser, isAuthenticated } from '$lib/stores/auth';
	import { pendingColorScheme } from '$lib/stores/theme';
	import { apiClient, HttpError } from '$lib/api/client';
	import {
		validateProfileForm,
		sanitizeInput,
		getPasswordStrength,
		getPasswordStrengthLabel
	} from '$lib/utils/auth';
	import { FormValidator, createDebouncedValidator } from '$lib/utils/validation';
	import { errorLogger, captureApiError } from '$lib/utils/error-handler';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import CurrentPasswordInput from '$lib/components/CurrentPasswordInput.svelte';
	import type { ProfileFormData, FormErrors, UserUpdate } from '$lib/types/auth';
	import type { ConnectedApp } from '$lib/types/connect';
	import type {
		PlanDetailResponse,
		PlanPrice,
		SubscriptionStatusResponse
	} from '$lib/types/billing';

	// State
	let isLoading = $state(true);
	let isSaving = $state(false);
	let showPasswordChange = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);
	let successMessage = $state('');
	let generalError = $state('');

	// Connect app state
	let connectCode = $state('');
	let connectCodeExpiresIn = $state<number | undefined>(undefined);
	let connectCodeLoading = $state(false);
	let connectCodeError = $state('');
	let connectCodeCopied = $state(false);
	let connectedApps = $state<ConnectedApp[]>([]);
	let connectedAppsLoading = $state(false);
	let connectedAppsError = $state('');

	// Access code state
	let accessCodeInput = $state('');
	let accessCodeActivating = $state(false);
	let accessCodeError = $state('');
	let accessCodeSuccess = $state('');

	// Verify email state
	let verifyEmailLoading = $state(false);
	let verifyEmailSuccess = $state('');
	let verifyEmailError = $state('');

	// Feedback state
	let feedbackContent = $state('');
	let feedbackSubmitting = $state(false);
	let feedbackError = $state('');
	let feedbackSuccess = $state('');

	// Billing / checkout state
	let checkoutLoading = $state(false);
	let checkoutError = $state('');
	let subscriptionStatus = $state<SubscriptionStatusResponse | null>(null);
	let subscriptionLoading = $state(false);
	let subscriptionError = $state('');
	let plans = $state<PlanDetailResponse[]>([]);
	let plansLoading = $state(false);
	let plansError = $state('');
	// Derived: active subscription from user (prefer) or from GET /billing/subscription
	let hasActiveSubscription = $derived(
		$currentUser?.subscription?.status === 'active' ||
			$currentUser?.subscription?.status === 'trialing' ||
			subscriptionStatus?.status === 'active' ||
			subscriptionStatus?.status === 'trialing'
	);
	let currentPlanProductId = $derived($currentUser?.subscription?.product_id ?? null);
	let currentPeriodEnd = $derived(
		$currentUser?.subscription?.current_period_end ?? subscriptionStatus?.current_period_end ?? null
	);

	// Billing: partition by plan_type prefix (backend: monthly_core_ai, annual_core_ai, etc.)
	function isMonthlyPlan(plan: PlanDetailResponse): boolean {
		return typeof plan.plan_type === 'string' && plan.plan_type.startsWith('monthly');
	}
	function isAnnualPlan(plan: PlanDetailResponse): boolean {
		return typeof plan.plan_type === 'string' && plan.plan_type.startsWith('annual');
	}

	let subscriptionPlans = $derived.by(() => {
		const list = plans.filter((p) => isMonthlyPlan(p) || isAnnualPlan(p));
		return [...list].sort((a, b) => {
			if (isMonthlyPlan(a) && !isMonthlyPlan(b)) return -1;
			if (!isMonthlyPlan(a) && isMonthlyPlan(b)) return 1;
			if (isAnnualPlan(a) && !isAnnualPlan(b)) return -1;
			if (!isAnnualPlan(a) && isAnnualPlan(b)) return 1;
			return 0;
		});
	});

	// Subscription section: derived flags for clearer branching
	let showSubscriptionLoaded = $derived(!subscriptionLoading);
	let showActivePlan = $derived(showSubscriptionLoaded && !!hasActiveSubscription);
	let showPlansSection = $derived(showSubscriptionLoaded && !plansLoading && !plansError);
	let showPlansList = $derived(
		showPlansSection && !hasActiveSubscription && subscriptionPlans.length > 0
	);

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

	// Derived: has any change that requires current password to save
	let usernameChanged = $derived(
		$currentUser !== null && formData.username !== ($currentUser?.username ?? '')
	);
	let emailChanged = $derived(
		$currentUser !== null && formData.email !== ($currentUser?.email ?? '')
	);
	let colorSchemeChanged = $derived(
		$currentUser !== null && formData.colorScheme !== ($currentUser?.color_scheme || 'default')
	);
	// Form validator
	let validator: FormValidator<ProfileFormData>;
	let debouncedValidator: ReturnType<typeof createDebouncedValidator>;

	// Initialize validator
	$effect(() => {
		validator = new FormValidator({
			username: {
				required: true,
				rules: [] // Username validation handled by validateProfileForm
			},
			email: {
				required: true,
				rules: [] // Email validation handled by validateProfileForm
			},
			currentPassword: {
				required: false // Only required when changing password/username/email
			},
			newPassword: {
				required: false // Only required when changing password
			},
			confirmNewPassword: {
				required: false // Only required when changing password
			}
		});

		debouncedValidator = createDebouncedValidator(validator);
	});

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
				console.warn('Failed to refresh user data, using existing data:', error);
				// Don't block the page if refresh fails - allow form to work with existing data
				generalError = 'Could not refresh user data. You can still update your profile.';
			}

			// Initialize form with current user data
			if ($currentUser) {
				formData.username = $currentUser.username || '';
				formData.email = $currentUser.email;
				formData.colorScheme = $currentUser.color_scheme || 'default';
			}

			// Load connected apps
			connectedAppsLoading = true;
			connectedAppsError = '';
			try {
				errorLogger.logDebug('Loading connected apps');
				connectedApps = await apiClient.getConnectedApps();
				errorLogger.logDebug('Connected apps loaded successfully', { count: connectedApps.length });
			} catch (err) {
				connectedAppsError = captureApiError(err, {
					component: 'Profile',
					operation: 'loadConnectedApps'
				});
			} finally {
				connectedAppsLoading = false;
			}

			// Load subscription status
			subscriptionLoading = true;
			subscriptionError = '';
			try {
				errorLogger.logDebug('Loading subscription status');
				subscriptionStatus = await apiClient.getSubscription();
				errorLogger.logDebug('Subscription status loaded', {
					status: subscriptionStatus?.status ?? null
				});
			} catch (err) {
				subscriptionError = captureApiError(err, {
					component: 'Profile',
					operation: 'loadSubscription'
				});
			} finally {
				subscriptionLoading = false;
			}

			// Load billing plans
			plansLoading = true;
			plansError = '';
			try {
				errorLogger.logDebug('Loading billing plans');
				plans = await apiClient.getBillingPlans();
				errorLogger.logDebug('Billing plans loaded', { count: plans.length });
			} catch (err) {
				plansError = captureApiError(err, {
					component: 'Profile',
					operation: 'loadBillingPlans'
				});
			} finally {
				plansLoading = false;
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
		console.log('[Profile] Form submitted');
		console.log('[Profile] handleSubmit called');
		console.log('[Profile] Form data:', {
			username: formData.username,
			email: formData.email,
			hasCurrentPassword: !!formData.currentPassword,
			hasNewPassword: !!formData.newPassword,
			hasConfirmPassword: !!formData.confirmNewPassword
		});
		console.log('[Profile] Current user:', {
			id: $currentUser?.id,
			username: $currentUser?.username,
			email: $currentUser?.email
		});

		event.preventDefault();
		generalError = '';
		successMessage = '';
		isSaving = true;

		// Determine if password change is requested (only if new password fields are filled)
		const isChangingPassword = !!(formData.newPassword || formData.confirmNewPassword);

		// Check if username, email, or color scheme changed
		const usernameChanged = $currentUser && formData.username !== $currentUser.username;
		const emailChanged = $currentUser && formData.email !== $currentUser.email;
		const colorSchemeChanged =
			$currentUser && formData.colorScheme !== ($currentUser.color_scheme || 'default');

		console.log('[Profile] Change detection:', {
			usernameChanged,
			emailChanged,
			colorSchemeChanged,
			isChangingPassword,
			originalUsername: $currentUser?.username,
			newUsername: formData.username,
			originalEmail: $currentUser?.email,
			newEmail: formData.email,
			originalColorScheme: $currentUser?.color_scheme,
			newColorScheme: formData.colorScheme
		});

		if (isChangingPassword) {
			formData.currentPassword = formData.currentPassword || '';
			formData.newPassword = formData.newPassword || '';
			formData.confirmNewPassword = formData.confirmNewPassword || '';
		}

		// Validate form (pass original user for change detection)
		const validationErrors = validateProfileForm(formData, $currentUser || undefined);
		console.log('[Profile] Validation errors:', validationErrors);
		if (Object.keys(validationErrors).length > 0) {
			console.log('[Profile] Validation failed, stopping submission');
			errors = validationErrors;
			isSaving = false;
			return;
		}
		console.log('[Profile] Validation passed');

		try {
			const updateData: UserUpdate = {
				// current_password is always required by backend
				current_password: formData.currentPassword || ''
			};

			console.log('[Profile] Including current_password in update (hidden)');

			// Only include changed fields
			if (usernameChanged) {
				updateData.username = formData.username;
				console.log('[Profile] Including username in update:', formData.username);
			}
			if (emailChanged) {
				updateData.email = formData.email;
				console.log('[Profile] Including email in update:', formData.email);
			}
			if (colorSchemeChanged) {
				updateData.color_scheme = formData.colorScheme;
				console.log('[Profile] Including color_scheme in update:', formData.colorScheme);
			}
			if (isChangingPassword && formData.newPassword) {
				updateData.password = formData.newPassword;
				console.log('[Profile] Including password in update (hidden)');
			}

			console.log('[Profile] Update data object:', {
				...updateData,
				current_password: updateData.current_password ? '***hidden***' : undefined,
				password: updateData.password ? '***hidden***' : undefined
			});

			// Update user profile using the current user endpoint (no user ID needed)
			console.log('[Profile] Calling apiClient.updateCurrentUser with:', {
				updateData: {
					...updateData,
					current_password: updateData.current_password ? '***hidden***' : undefined,
					password: updateData.password ? '***hidden***' : undefined
				}
			});
			const updatedUser = await apiClient.updateCurrentUser(updateData);

			console.log('[Profile] API call successful');
			console.log('[Profile] Updated user response:', {
				id: updatedUser.id,
				username: updatedUser.username,
				email: updatedUser.email
			});

			// Update the auth store with new user data
			authActions.updateUser(updatedUser);
			pendingColorScheme.set(null);

			// Reset password fields
			formData.currentPassword = '';
			formData.newPassword = '';
			formData.confirmNewPassword = '';
			showPasswordChange = false;

			successMessage = 'Profile updated successfully!';
			console.log('[Profile] Profile update completed successfully');
		} catch (error) {
			generalError = captureApiError(error, {
				component: 'Profile',
				operation: 'updateProfile'
			});
		} finally {
			errorLogger.logDebug('[Profile] handleSubmit completed', { operation: 'updateProfile' });
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

	// Connect app: request code
	async function handleConnectApp() {
		connectCodeError = '';
		connectCode = '';
		connectCodeExpiresIn = undefined;
		connectCodeLoading = true;
		try {
			errorLogger.logDebug('Requesting connection code');
			const res = await apiClient.requestConnectCode();
			connectCode = res.connection_code;
			connectCodeExpiresIn = res.expires_in;
			errorLogger.logDebug('Connection code requested successfully');
		} catch (err) {
			connectCodeError = captureApiError(err, {
				component: 'Profile',
				operation: 'requestConnectCode'
			});
		} finally {
			connectCodeLoading = false;
		}
	}

	// Connect app: copy code to clipboard
	async function handleCopyCode() {
		if (!connectCode) return;
		connectCodeCopied = false;
		try {
			await navigator.clipboard.writeText(connectCode);
			connectCodeCopied = true;
			setTimeout(() => (connectCodeCopied = false), 2000);
		} catch {
			connectCodeError = 'Could not copy to clipboard.';
		}
	}

	// Connect app: close / clear code display
	function handleCloseConnectCode() {
		connectCode = '';
		connectCodeExpiresIn = undefined;
		connectCodeError = '';
		connectCodeCopied = false;
	}

	// Connect app: revoke a specific connected app
	let revokingAppId = $state<number | null>(null);
	let revokeError = $state<string>('');

	async function handleRevokeConnectedApp(appId: number) {
		revokeError = '';
		revokingAppId = appId;
		try {
			errorLogger.logDebug('Revoking connected app', { appId });
			await apiClient.revokeConnectedApp(appId);
			// Optimistically remove the app from the local list
			connectedApps = connectedApps.filter((app) => app.id !== appId);
			errorLogger.logDebug('Connected app revoked successfully', { appId });
		} catch (err) {
			revokeError = captureApiError(err, {
				component: 'Profile',
				operation: 'revokeConnectedApp',
				appId
			});
		} finally {
			revokingAppId = null;
		}
	}

	// Access code: activate code for current user
	async function handleActivateAccessCode() {
		const code = accessCodeInput.trim();
		accessCodeError = '';
		accessCodeSuccess = '';
		if (code.length !== 8) {
			accessCodeError = 'Please enter an 8-character code.';
			return;
		}
		accessCodeActivating = true;
		try {
			await apiClient.activateAccessCode({ code });
			accessCodeInput = '';
			accessCodeSuccess = 'Access code activated.';
			await authActions.refreshUser();
			setTimeout(() => (accessCodeSuccess = ''), 4000);
		} catch (err) {
			accessCodeError = captureApiError(err, {
				component: 'Profile',
				operation: 'activateAccessCode'
			});
		} finally {
			accessCodeActivating = false;
		}
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
				id: $currentUser?.id,
				email: $currentUser?.email,
				username: $currentUser?.username,
				platform: 'web'
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

	// Billing: user-facing message for checkout errors (503, 502, or generic)
	function getCheckoutErrorMessage(err: unknown): string {
		if (err instanceof HttpError) {
			if (err.status === 503) return 'Billing is temporarily unavailable.';
			if (err.status === 502) return 'Something went wrong. Try again later.';
		}
		return captureApiError(err, {
			component: 'Profile',
			operation: 'createCheckoutSession'
		});
	}

	// Billing: format plan price for display (cents -> $X.XX, interval)
	function formatPlanPrice(price: PlanPrice): string {
		const amount = (price.price / 100).toFixed(2);
		const symbol = price.currency === 'USD' ? '$' : price.currency + ' ';
		const count = price.payment_frequency_count ?? 1;
		const interval = (price.payment_frequency_interval ?? 'Month').toLowerCase();
		const intervalLabel = count === 1 ? interval : `${count} ${interval}s`;
		return `${symbol}${amount}/${intervalLabel}`;
	}

	// Billing: create checkout session for plan and redirect to Dodo (card click or Manage Subscription)
	async function handleCheckout(productId: string) {
		if (!productId) return;
		checkoutError = '';
		checkoutLoading = true;
		try {
			errorLogger.logDebug('Creating checkout session', { productId });
			const returnUrl =
				typeof window !== 'undefined' ? `${window.location.origin}${base}/` : undefined;
			const data = await apiClient.createCheckoutSession({
				product_id: productId,
				return_url: returnUrl ?? undefined
			});
			if (!data?.checkout_url) {
				errorLogger.logError(new Error('Missing checkout_url in response'), {
					operation: 'createCheckoutSession'
				});
				checkoutError = 'Checkout is temporarily unavailable. Please try again later.';
				return;
			}
			errorLogger.logDebug('Checkout session created, redirecting');
			window.location.href = data.checkout_url;
		} catch (err) {
			errorLogger.logError(err instanceof Error ? err : new Error(String(err)), {
				operation: 'createCheckoutSession'
			});
			checkoutError = getCheckoutErrorMessage(err);
		} finally {
			checkoutLoading = false;
		}
	}

	// Format date for display
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Profile - Flit Web</title>
	<meta
		name="description"
		content="Manage your Flit Web account profile and knowledge graph access."
	/>
</svelte:head>

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

		<div class="card">
			<h2>Connected Apps</h2>

			<!-- Connected Apps List -->
			{#if connectedAppsError || revokeError}
				<div class="alert alert--error" role="alert">
					<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
					<div class="alert__message card__block">
						{#if connectedAppsError}
							<p>{connectedAppsError}</p>
						{/if}
						{#if revokeError}
							<p>{revokeError}</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if connectedAppsLoading}
				<div class="loading loading--muted">
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
					<span>Loading connected apps...</span>
				</div>
			{:else if connectedApps.length > 0}
				<div class="card__column">
					{#each connectedApps as app (app.id)}
						<div class="card">
							<div class="card__column">
								<div class="card__row card__row--between">
									<span>
										{app.app_name || app.device_name}
									</span>
									<span class="badge {app.is_active ? 'badge--positive' : 'badge--muted'}">
										{app.is_active ? 'Active' : 'Inactive'}
									</span>
								</div>
								<div class="card__row text-sm">
									{app.device_name}
									{#if app.platform}
										<span class="profile-status-dot">•</span>
										{app.platform}
									{/if}
								</div>
								<div class="card__row text-xs">
									Connected {formatDate(app.created_at)}
								</div>
								<div class="card__row card__row--end">
									{#if app.is_active}
										<button
											type="button"
											class="btn btn--compact"
											onclick={() => handleRevokeConnectedApp(app.id)}
											disabled={revokingAppId === app.id}
											aria-label={`Revoke connected app ${app.app_name || app.device_name}`}
										>
											{#if revokingAppId === app.id}
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
												Revoking…
											{:else}
												Revoke
											{/if}
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="card__meta">No connected apps yet. Connect an app to get started.</div>
			{/if}

			{#if connectCodeError}
				<div class="alert alert--error" role="alert">
					<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="alert__message">{connectCodeError}</p>
				</div>
			{/if}

			<div class="card__column">
				{#if connectCode}
					<div class="card__column card__column--center">
						<p class="card__meta">Enter this code in the app you wish to connect to Flit - Core</p>
						<div class="card text-md" aria-label="Connection code">
							{connectCode}
						</div>
						{#if connectCodeExpiresIn != null && connectCodeExpiresIn > 0}
							{@const minutes = Math.ceil(connectCodeExpiresIn / 60)}
							<p class="card__meta">
								This code expires in {minutes} minute{minutes === 1 ? '' : 's'}.
							</p>
						{/if}
						<div class="auth__actions">
							<button
								type="button"
								onclick={handleCopyCode}
								class="btn"
								aria-label="Copy connection code"
							>
								{connectCodeCopied ? 'Copied!' : 'Copy'}
							</button>
							<button
								type="button"
								onclick={handleConnectApp}
								disabled={connectCodeLoading}
								class="btn"
								aria-label="Get new connection code"
							>
								Get new code
							</button>
							<button
								type="button"
								onclick={handleCloseConnectCode}
								class="btn btn-primary"
								aria-label="Close connection code"
							>
								Close
							</button>
						</div>
					</div>
				{:else}
					<button
						type="button"
						onclick={handleConnectApp}
						disabled={connectCodeLoading}
						class="btn btn-primary"
						aria-label="Request connection code to connect an app to Flit Core"
					>
						{#if connectCodeLoading}
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
							Requesting...
						{:else}
							+ Connect App
						{/if}
					</button>
				{/if}
			</div>
		</div>

		<!-- Access Code -->
		<div class="card">
			<h2>Access Code</h2>
			{#if $currentUser?.access_grant}
				<div class="alert alert--success card__block" role="status">
					<p class="card__label">
						Access active until {formatDate($currentUser.access_grant.expires_at)}
					</p>
					<p class="card__meta">
						Includes encryption: {$currentUser.access_grant.includes_encryption ? 'Yes' : 'No'}
					</p>
				</div>
			{:else}
				<p class="card__meta">Enter an 8-character access code to activate time-limited access.</p>
				{#if accessCodeError}
					<div class="alert alert--error" role="alert">
						<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
						<p class="alert__message">{accessCodeError}</p>
					</div>
				{/if}
				{#if accessCodeSuccess}
					<div class="alert alert--success alert--mb-md" role="alert">
						<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
						<p class="alert__message">{accessCodeSuccess}</p>
					</div>
				{/if}
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleActivateAccessCode();
					}}
					class="card__row card__row--start"
				>
					<div class="form-group form-group--mb-none">
						<label for="access-code-input" class="visually-hidden">Access code</label>
						<input
							id="access-code-input"
							type="text"
							maxlength="8"
							placeholder="Enter 8-character code"
							bind:value={accessCodeInput}
							disabled={accessCodeActivating}
							class="input input--code"
							autocomplete="off"
						/>
					</div>
					<button
						type="submit"
						class="btn btn-primary"
						disabled={accessCodeActivating || accessCodeInput.trim().length !== 8}
					>
						{#if accessCodeActivating}
							Activating…
						{:else}
							Activate
						{/if}
					</button>
				</form>
			{/if}
		</div>

		<!-- Billing -->
		<div class="card">
			<h2>Billing</h2>
			<p class="card__meta">Manage your subscription and payment.</p>

			{#if subscriptionLoading}
				<p class="card__meta">Loading subscription…</p>
			{:else if subscriptionError}
				<div class="alert alert--error" role="alert">
					<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="alert__message">{subscriptionError}</p>
				</div>
			{/if}

			{#if showActivePlan}
				<div class="alert alert--success card__block alert--mb-md" role="status">
					<p class="card__label">You have an active subscription.</p>
					{#if currentPlanProductId && subscriptionPlans.length > 0}
						{@const currentPlan = subscriptionPlans.find(
							(p) => p.product_id === currentPlanProductId
						)}
						{#if currentPlan?.name}
							<p class="card__meta">Your plan: {currentPlan.name}</p>
						{/if}
					{/if}
					{#if currentPeriodEnd}
						<p class="card__meta">
							Next billing date: {formatDate(currentPeriodEnd)}
						</p>
					{/if}
					{#if currentPlanProductId}
						<button
							type="button"
							onclick={() => handleCheckout(currentPlanProductId)}
							disabled={checkoutLoading}
							class="btn btn-primary mt-md"
							aria-label="Manage Subscription"
						>
							{#if checkoutLoading}
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
								Redirecting…
							{:else}
								Manage Subscription
							{/if}
						</button>
					{/if}
				</div>
			{/if}

			{#if showSubscriptionLoaded}
				{#if checkoutError}
					<div class="alert alert--error" role="alert">
						<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
						<p class="alert__message">{checkoutError}</p>
					</div>
				{/if}
				{#if !hasActiveSubscription && subscriptionStatus?.status !== null && subscriptionStatus !== null}
					{@const status = subscriptionStatus?.status ?? ''}
					{@const isPaymentIssue = ['past_due', 'on_hold', 'failed'].includes(status)}
					<p class="card__meta card__meta--mb-md">
						{isPaymentIssue
							? 'Payment issue — update your payment method or resubscribe below.'
							: 'Subscription canceled or expired. Choose a plan to resubscribe.'}
					</p>
				{:else if !hasActiveSubscription}
					<p class="card__meta card__meta--mb-md">
						Upgrade or manage your subscription via secure checkout.
					</p>
				{/if}

				{#if plansLoading}
					<p class="card__meta">Loading plans…</p>
				{:else if plansError}
					<div class="alert alert--error" role="alert">
						<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
						<p class="alert__message">{plansError}</p>
					</div>
				{:else if plans.length === 0}
					<p class="card__meta">No plans available at the moment.</p>
				{:else if showPlansList}
					<!-- Subscription plans: click card to go to checkout -->
					<div class="grid-cards grid-cards--plans">
						{#each subscriptionPlans as plan (plan.product_id)}
							<button
								type="button"
								onclick={() => handleCheckout(plan.product_id)}
								disabled={checkoutLoading}
								class="plan-card"
								aria-label="Subscribe to {plan.name ?? 'subscription plan'} – go to checkout"
							>
								{#if plan.image}
									<img src={plan.image} alt="" class="plan-card__image" />
								{/if}
								<h3 class="plan-card__title">
									{plan.name ?? 'Subscription plan'}
								</h3>
								{#if plan.description}
									<div class="plan-card__description card__meta">
										{#each plan.description.split(/\n/).filter(Boolean) as paragraph (paragraph)}
											<p>{paragraph}</p>
										{/each}
									</div>
								{/if}
								<div class="plan-card__price card__label text-md">
									{formatPlanPrice(plan.price)}
								</div>
								{#if checkoutLoading}
									<div class="profile-section__row card__meta mt-md text-sm">
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
										<span>Redirecting to checkout…</span>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<!-- Profile Form -->
		<div>
			<form
				class="card"
				onsubmit={(e) => {
					console.log('[Profile] Form onsubmit event fired');
					handleSubmit(e);
				}}
				novalidate
			>
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
						{#if colorSchemeChanged && !formData.currentPassword}
							<p>Enter your current password below and click Save to apply.</p>
						{/if}
						<div class="color-scheme-picker">
							<div
								class="radio-card radio-card--light-preview"
								class:radio-card--selected={formData.colorScheme === 'light'}
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
									<span>Light</span>
									<p class="muted">Bright and clear</p>
								</div>
							</div>
							<div
								class="radio-card radio-card--dark-preview"
								class:radio-card--selected={formData.colorScheme === 'dark'}
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
									<span>Dark</span>
									<p class="muted">Easy on the eyes</p>
								</div>
							</div>
							<div
								class="radio-card radio-card--auto-preview"
								class:radio-card--selected={formData.colorScheme === 'default'}
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
									<span>Auto</span>
									<p class="muted">Follow system</p>
								</div>
							</div>
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
					</div>

					<!-- Account Dates -->
					<div>
						<div>
							<span class="card__label--muted"> Member Since: </span>
							<span class="card__meta" aria-label="Account creation date">
								{formatDate($currentUser.created_at)}
							</span>
						</div>
						<div>
							<span class="card__label--muted"> Last Updated: </span>
							<span class="card__meta" aria-label="Account last updated date">
								{formatDate($currentUser.updated_at)}
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

					{#if (usernameChanged || emailChanged || colorSchemeChanged) && !showPasswordChange}
						<CurrentPasswordInput
							id="currentPasswordForChange"
							name="currentPasswordForChange"
							requiredToSave={true}
							value={formData.currentPassword}
							oninput={(v) => handleFieldChange('currentPassword', v)}
							error={errors.currentPassword}
							disabled={isSaving}
							bind:showPassword={showCurrentPassword}
							errorId="current-password-error-change"
						/>
					{/if}

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
