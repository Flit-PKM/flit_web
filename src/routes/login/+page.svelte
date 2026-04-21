<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, isAuthenticated, isLoading } from '$lib/stores/auth';
	import { validateLoginForm, loginRateLimiter, sanitizeInput } from '$lib/utils/auth';
	import { FormValidator, createDebouncedValidator } from '$lib/utils/validation';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import type { LoginFormData, FormErrors } from '$lib/types/auth';

	// Form state
	let formData: LoginFormData = $state({
		email: '',
		password: ''
	});

	let errors: FormErrors = $state({});
	let generalError = $state('');
	let isSubmitting = $state(false);
	let showPassword = $state(false);

	// Form validator
	let validator: FormValidator<LoginFormData>;
	let debouncedValidator: ReturnType<typeof createDebouncedValidator>;

	// Initialize validator
	$effect(() => {
		validator = new FormValidator({
			email: {
				required: true,
				rules: [] // Email validation handled by validateLoginForm
			},
			password: {
				required: true
			}
		});

		debouncedValidator = createDebouncedValidator(validator);
	});

	// Redirect if already authenticated
	$effect(() => {
		if ($isAuthenticated) {
			goto(resolve('/notes'));
		}
	});

	// Handle form field changes with validation
	function handleFieldChange(field: keyof LoginFormData, value: string) {
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

		// Check rate limiting
		if (!loginRateLimiter.isAllowed(formData.email)) {
			const remainingTime = Math.ceil(
				loginRateLimiter.getRemainingTime(formData.email) / 1000 / 60
			);
			generalError = `Too many login attempts. Please try again in ${remainingTime} minutes.`;
			isSubmitting = false;
			return;
		}

		// Validate form
		const validationErrors = validateLoginForm(formData);
		if (Object.keys(validationErrors).length > 0) {
			errors = validationErrors;
			isSubmitting = false;
			return;
		}

		// Record login attempt
		loginRateLimiter.recordAttempt(formData.email);

		// Attempt login
		const result = await authActions.login(formData);

		if (result.success) {
			// Redirect to intended page or notes (allowlist for type-safe goto)
			const ALLOWED_REDIRECTS = ['/profile', '/notes', '/', '/about', '/terms'] as const;
			const requested = $page.url.searchParams.get('redirect') || '/notes';
			const path = ALLOWED_REDIRECTS.includes(requested as (typeof ALLOWED_REDIRECTS)[number])
				? (requested as (typeof ALLOWED_REDIRECTS)[number])
				: '/notes';
			goto(resolve(path) as Parameters<typeof goto>[0]);
		} else {
			generalError = result.error || 'Login failed. Please try again.';
		}

		isSubmitting = false;
	}

	// Handle password visibility toggle
	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	// Focus management for accessibility
	let emailInput: HTMLInputElement;
	let passwordInput: HTMLInputElement;

	onMount(() => {
		// Auto-focus email field
		emailInput?.focus();
	});
</script>

<svelte:head>
	<title>Sign In - Flit Web</title>
	<meta
		name="description"
		content="Sign in to your Flit Web account to access your knowledge graph."
	/>
</svelte:head>

<div class="auth">
	<div class="auth__inner">
		<div class="auth__header">
			<h1>Welcome back</h1>
			<p>Sign in to your account to continue</p>
		</div>
		<div class="card">
			<form onsubmit={handleSubmit} novalidate>
				{#if $page.url.searchParams.get('password_reset') === 'success'}
					<div class="alert alert--success" role="status">
						<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<p class="alert__message">Password updated. Please sign in.</p>
					</div>
				{/if}

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
							bind:this={passwordInput}
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							required
							disabled={isSubmitting}
							class="input wide"
							class:input--error={!!errors.password}
							placeholder="Enter your password"
							bind:value={formData.password}
							oninput={(e) => handleFieldChange('password', e.currentTarget.value)}
							aria-describedby={errors.password ? 'password-error' : undefined}
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
					{#if errors.password}
						<p id="password-error" class="form-group__error" role="alert">{errors.password}</p>
					{/if}
				</div>

				<GeneralErrorAlert message={generalError} />

				<div class="auth__actions">
					<button
						type="submit"
						disabled={isSubmitting || $isLoading}
						class="btn btn-primary btn--block"
					>
						{#if isSubmitting || $isLoading}
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
							Signing in...
						{:else}
							Sign in
						{/if}
					</button>
				</div>

				<div class="auth__links">
					<p class="card__meta">
						Don't have an account?
						<a href={resolve('/register')}>Sign up here</a>
					</p>
					<p class="card__meta">
						<a href={resolve('/forgot-password')}>Forgot your password?</a>
					</p>
				</div>
			</form>
		</div>
	</div>
</div>
