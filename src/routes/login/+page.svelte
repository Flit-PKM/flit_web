<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base, resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, isAuthenticated, isLoading } from '$lib/stores/auth';
	import { validateLoginForm, loginRateLimiter, sanitizeInput } from '$lib/utils/auth';
	import { FormValidator, createDebouncedValidator } from '$lib/utils/validation';
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
			goto(resolve('/profile'));
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
			// Redirect to intended page or profile
			const redirectTo = $page.url.searchParams.get('redirect') || '/profile';
			goto(resolve(redirectTo));
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

<div class="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="mb-2 text-3xl font-bold text-flit-ink">Welcome back</h1>
			<p class="text-flit-muted">Sign in to your account to continue</p>
		</div>

		<!-- Form (landing card style) -->
		<form
			class="mb-4 space-y-6 rounded-2xl bg-flit-card px-6 pt-6 pb-8 shadow-flit-sm backdrop-blur-sm sm:px-8"
			onsubmit={handleSubmit}
			novalidate
		>
			<!-- Email Field -->
			<div>
				<label for="email" class="mb-2 block text-sm font-medium text-flit-ink">
					Email address
				</label>
				<input
					bind:this={emailInput}
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					disabled={isSubmitting}
					class="input backdrop-blur-sm transition-colors disabled:cursor-not-allowed"
					class:border-flit-negative={errors.email}
					class:focus:ring-flit-negative={errors.email}
					class:focus:border-flit-negative={errors.email}
					placeholder="Enter your email"
					bind:value={formData.email}
					oninput={(e) => handleFieldChange('email', e.currentTarget.value)}
					aria-describedby={errors.email ? 'email-error' : undefined}
					aria-invalid={!!errors.email}
				/>
				{#if errors.email}
					<p id="email-error" class="mt-1 text-sm text-flit-negative" role="alert">
						{errors.email}
					</p>
				{/if}
			</div>

			<!-- Password Field -->
			<div>
				<label for="password" class="mb-2 block text-sm font-medium text-flit-ink">
					Password
				</label>
				<div class="relative">
					<input
						bind:this={passwordInput}
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="current-password"
						required
						disabled={isSubmitting}
						class="input pr-10 backdrop-blur-sm transition-colors disabled:cursor-not-allowed"
						class:border-flit-negative={errors.password}
						class:focus:ring-flit-negative={errors.password}
						class:focus:border-flit-negative={errors.password}
						placeholder="Enter your password"
						bind:value={formData.password}
						oninput={(e) => handleFieldChange('password', e.currentTarget.value)}
						aria-describedby={errors.password ? 'password-error' : undefined}
						aria-invalid={!!errors.password}
					/>
					<button
						type="button"
						class="absolute inset-y-0 right-0 flex items-center pr-3 text-flit-muted transition-opacity hover:opacity-80"
						onclick={togglePasswordVisibility}
						disabled={isSubmitting}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
					>
						{#if showPassword}
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.05 8.05m1.829 1.829l4.242 4.242M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.563 3.029m-5.858-.908a3 3 0 01-4.243-4.243"
								/>
							</svg>
						{:else}
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
					<p id="password-error" class="mt-1 text-sm text-flit-negative" role="alert">
						{errors.password}
					</p>
				{/if}
			</div>

			<!-- General Error -->
			{#if generalError}
				<div class="rounded-lg border border-flit-negative/30 bg-flit-negative/10 p-4" role="alert">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-flit-negative" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-flit-ink">
								{generalError}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Submit Button -->
			<div>
				<button
					type="submit"
					disabled={isSubmitting || $isLoading}
					class="btn btn-primary w-full justify-center py-3 disabled:cursor-not-allowed"
				>
					{#if isSubmitting || $isLoading}
						<svg
							class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Signing in...
					{:else}
						Sign in
					{/if}
				</button>
			</div>

			<!-- Links -->
			<div class="space-y-2 text-center">
				<p class="text-sm text-flit-muted">
					Don't have an account?
					<a
						href={resolve('/register')}
						class="font-medium text-flit-link transition-opacity hover:opacity-80"
					>
						Sign up here
					</a>
				</p>
				<p class="text-sm text-flit-muted">
					<a
						href={base + '/forgot-password'}
						class="font-medium text-flit-link transition-opacity hover:opacity-80"
					>
						Forgot your password?
					</a>
				</p>
			</div>
		</form>
	</div>
</div>
