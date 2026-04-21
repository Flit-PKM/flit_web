<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAuthenticated, authActions } from '$lib/stores/auth';
	import {
		validateRegisterForm,
		sanitizeInput,
		getPasswordStrength,
		getPasswordStrengthLabel
	} from '$lib/utils/auth';
	import { FormValidator, createDebouncedValidator } from '$lib/utils/validation';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import type { RegisterFormData, FormErrors } from '$lib/types/auth';

	// Form state
	let formData: RegisterFormData = $state({
		email: '',
		password: '',
		confirmPassword: ''
	});

	let errors: FormErrors = $state({});
	let generalError = $state('');
	let isSubmitting = $state(false);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let passwordStrength = $state(0);
	let passwordStrengthLabel = $state('Very Weak');

	const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
	let turnstileReady = $state(!turnstileSiteKey);

	// Form validator
	let validator: FormValidator<RegisterFormData>;
	let debouncedValidator: ReturnType<typeof createDebouncedValidator>;

	// Initialize validator
	$effect(() => {
		validator = new FormValidator({
			email: {
				required: true,
				rules: [] // Email validation handled by validateRegisterForm
			},
			password: {
				required: true,
				rules: [] // Password validation handled by validateRegisterForm
			},
			confirmPassword: {
				required: true,
				rules: [] // Confirmation validation handled by validateRegisterForm
			}
		});

		debouncedValidator = createDebouncedValidator(validator);
	});

	// Update password strength when password changes
	$effect(() => {
		passwordStrength = getPasswordStrength(formData.password);
		passwordStrengthLabel = getPasswordStrengthLabel(passwordStrength);
	});

	// Redirect if already authenticated
	$effect(() => {
		if ($isAuthenticated) {
			goto(resolve('/profile'));
		}
	});

	// Handle form field changes with validation
	function handleFieldChange(field: keyof RegisterFormData, value: string) {
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
		isSubmitting = true;

		// Validate form
		const validationErrors = validateRegisterForm(formData);
		if (Object.keys(validationErrors).length > 0) {
			errors = validationErrors;
			isSubmitting = false;
			return;
		}

		const form = event.target as HTMLFormElement;
		const cfTurnstileResponse = form.querySelector<HTMLInputElement>(
			'[name="cf-turnstile-response"]'
		)?.value;

		// Attempt registration
		const result = await authActions.register({
			...formData,
			cf_turnstile_response: cfTurnstileResponse || null
		});

		if (result.success) {
			generalError = '';
			if (typeof turnstile !== 'undefined' && turnstile?.reset) {
				turnstile.reset('register-widget');
			}
			goto(
				resolve('/login') +
					'?message=' +
					encodeURIComponent('Registration successful! Please sign in.')
			);
		} else {
			generalError = result.error || 'Registration failed. Please try again.';
		}

		isSubmitting = false;
	}

	// Toggle password visibility
	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function toggleConfirmPasswordVisibility() {
		showConfirmPassword = !showConfirmPassword;
	}

	// Focus management for accessibility
	let emailInput: HTMLInputElement;

	onMount(() => {
		emailInput?.focus();

		if (turnstileSiteKey) {
			(window as Window & { onTurnstileSuccess?: () => void }).onTurnstileSuccess = () => {
				turnstileReady = true;
			};
			(window as Window & { onTurnstileError?: (code?: string) => void }).onTurnstileError = (
				code
			) => {
				console.error('Turnstile error:', code);
			};
		}

		return () => {
			if (turnstileSiteKey) {
				delete (window as Window & { onTurnstileSuccess?: () => void }).onTurnstileSuccess;
				delete (window as Window & { onTurnstileError?: (code?: string) => void }).onTurnstileError;
			}
		};
	});
</script>

<svelte:head>
	<title>Sign Up - Flit Web</title>
	<meta name="description" content="Create your Flit Web account to access your knowledge graph." />
	{#if turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="auth">
	<div class="auth__inner">
		<div class="auth__header">
			<h1>Create your account</h1>
			<p>Join the Flit-PKM ecosystem and manage your knowledge graph.</p>
		</div>
		<div class="card">
			<form onsubmit={handleSubmit} novalidate>
				<div class="form-group">
					<label for="email">Email address</label>
					<input
						bind:this={emailInput}
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						disabled={isSubmitting}
						class="input wide"
						class:input--error={!!errors.email}
						placeholder="Enter your email"
						bind:value={formData.email}
						oninput={(e) => handleFieldChange('email', e.currentTarget.value)}
						aria-describedby={errors.email ? 'email-error' : undefined}
						aria-invalid={!!errors.email}
					/>
					{#if errors.email}
						<p id="email-error" class="form-group__error" role="alert">{errors.email}</p>
					{/if}
				</div>

				<div class="form-group">
					<label for="password">Password</label>
					<div class="input-wrap">
						<input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							disabled={isSubmitting}
							class="input wide"
							class:input--error={!!errors.password}
							placeholder="Create a strong password"
							bind:value={formData.password}
							oninput={(e) => handleFieldChange('password', e.currentTarget.value)}
							aria-describedby={errors.password ? 'password-error' : 'password-strength'}
							aria-invalid={!!errors.password}
						/>
						<button
							type="button"
							class="input__action"
							onclick={togglePasswordVisibility}
							disabled={isSubmitting}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
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

					{#if formData.password}
						<div class="strength-bar">
							<div class="strength-bar__track">
								<div
									class="strength-bar__fill strength-bar__fill--{passwordStrength}"
									style="width: {(passwordStrength / 4) * 100}%"
								></div>
							</div>
							<span class="strength-bar__label strength-bar__label--{passwordStrength}">
								{passwordStrengthLabel}
							</span>
						</div>
						<p id="password-strength" class="form-group__hint">
							Use at least 8 characters with uppercase, lowercase, number, and special character.
						</p>
					{/if}

					{#if errors.password}
						<p id="password-error" class="form-group__error" role="alert">{errors.password}</p>
					{/if}
				</div>

				<div class="form-group">
					<label for="confirmPassword">Confirm password</label>
					<div class="input-wrap">
						<input
							id="confirmPassword"
							name="confirmPassword"
							type={showConfirmPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							disabled={isSubmitting}
							class="input wide"
							class:input--error={!!errors.confirmPassword}
							placeholder="Confirm your password"
							bind:value={formData.confirmPassword}
							oninput={(e) => handleFieldChange('confirmPassword', e.currentTarget.value)}
							aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
							aria-invalid={!!errors.confirmPassword}
						/>
						<button
							type="button"
							class="input__action"
							onclick={toggleConfirmPasswordVisibility}
							disabled={isSubmitting}
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
					{#if errors.confirmPassword}
						<p id="confirm-password-error" class="form-group__error" role="alert">
							{errors.confirmPassword}
						</p>
					{/if}
				</div>

				<GeneralErrorAlert message={generalError} />

				{#if turnstileSiteKey}
					<div
						class="cf-turnstile"
						data-sitekey={turnstileSiteKey}
						data-theme="auto"
						data-size="compact"
						data-action="register"
						data-callback="onTurnstileSuccess"
						data-error-callback="onTurnstileError"
						data-widget-id="register-widget"
					></div>
				{/if}

				<div class="auth__actions">
					<button
						type="submit"
						disabled={!turnstileReady || isSubmitting}
						class="btn btn-primary btn--block"
					>
						{#if isSubmitting}
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
							Creating account…
						{:else}
							Create account
						{/if}
					</button>
				</div>

				<p class="card__meta">
					Already have an account?
					<a href={resolve('/login')}>Sign in</a>
				</p>
			</form>
		</div>
	</div>
</div>
