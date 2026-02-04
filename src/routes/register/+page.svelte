<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAuthenticated } from '$lib/stores/auth';
	import { authActions } from '$lib/stores/auth';
	import {
		validateRegisterForm,
		sanitizeInput,
		getPasswordStrength,
		getPasswordStrengthLabel
	} from '$lib/utils/auth';
	import { FormValidator, createDebouncedValidator } from '$lib/utils/validation';
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

		// Attempt registration
		const result = await authActions.register(formData);

		if (result.success) {
			// Show success message and redirect to login
			generalError = ''; // Clear any errors
			// Note: Registration doesn't log the user in automatically
			// They need to verify their email or login manually
			goto(resolve('/login') + '?message=' + encodeURIComponent('Registration successful! Please sign in.'));
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
		// Auto-focus email field
		emailInput?.focus();
	});

	// Password strength color classes (flit tokens)
	function getStrengthColor(strength: number): string {
		switch (strength) {
			case 0:
				return 'bg-flit-muted/30';
			case 1:
				return 'bg-flit-negative';
			case 2:
				return 'bg-amber-500';
			case 3:
				return 'bg-amber-400';
			case 4:
				return 'bg-flit-positive';
			default:
				return 'bg-flit-muted/30';
		}
	}

	function getStrengthTextColor(strength: number): string {
		switch (strength) {
			case 0:
				return 'text-flit-muted';
			case 1:
				return 'text-flit-negative';
			case 2:
				return 'text-amber-600';
			case 3:
				return 'text-amber-600';
			case 4:
				return 'text-flit-positive';
			default:
				return 'text-flit-muted';
		}
	}
</script>

<svelte:head>
	<title>Sign Up - Flit Web</title>
	<meta name="description" content="Create your Flit Web account to access your knowledge graph." />
</svelte:head>

<div class="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="mb-2 text-3xl font-bold text-flit-ink">Create your account</h1>
			<p class="text-flit-muted">Join the Flit-PKM ecosystem and manage your knowledge graph.</p>
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
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="new-password"
						required
						disabled={isSubmitting}
						class="input pr-10 backdrop-blur-sm transition-colors disabled:cursor-not-allowed"
						class:border-flit-negative={errors.password}
						class:focus:ring-flit-negative={errors.password}
						class:focus:border-flit-negative={errors.password}
						placeholder="Create a strong password"
						bind:value={formData.password}
						oninput={(e) => handleFieldChange('password', e.currentTarget.value)}
						aria-describedby={errors.password ? 'password-error' : 'password-strength'}
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

				<!-- Password Strength Indicator -->
				{#if formData.password}
					<div class="mt-2">
						<div class="flex items-center space-x-2">
							<div class="h-2 flex-1 rounded-full bg-flit-muted/20">
								<div
									class="h-2 rounded-full transition-all duration-300 {getStrengthColor(
										passwordStrength
									)}"
									style="width: {(passwordStrength / 4) * 100}%"
								></div>
							</div>
							<span class="text-xs font-medium {getStrengthTextColor(passwordStrength)}">
								{passwordStrengthLabel}
							</span>
						</div>
						<p id="password-strength" class="mt-1 text-xs text-flit-muted">
							Use at least 8 characters with uppercase, lowercase, number, and special character.
						</p>
					</div>
				{/if}

				{#if errors.password}
					<p id="password-error" class="mt-1 text-sm text-flit-negative" role="alert">
						{errors.password}
					</p>
				{/if}
			</div>

			<!-- Confirm Password Field -->
			<div>
				<label for="confirmPassword" class="mb-2 block text-sm font-medium text-flit-ink">
					Confirm password
				</label>
				<div class="relative">
					<input
						id="confirmPassword"
						name="confirmPassword"
						type={showConfirmPassword ? 'text' : 'password'}
						autocomplete="new-password"
						required
						disabled={isSubmitting}
						class="input pr-10 backdrop-blur-sm transition-colors disabled:cursor-not-allowed"
						class:border-flit-negative={errors.confirmPassword}
						class:focus:ring-flit-negative={errors.confirmPassword}
						class:focus:border-flit-negative={errors.confirmPassword}
						placeholder="Confirm your password"
						bind:value={formData.confirmPassword}
						oninput={(e) => handleFieldChange('confirmPassword', e.currentTarget.value)}
						aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
						aria-invalid={!!errors.confirmPassword}
					/>
					<button
						type="button"
						class="absolute inset-y-0 right-0 flex items-center pr-3 text-flit-muted transition-opacity hover:opacity-80"
						onclick={toggleConfirmPasswordVisibility}
						disabled={isSubmitting}
						aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
					>
						{#if showConfirmPassword}
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
				{#if errors.confirmPassword}
					<p id="confirm-password-error" class="mt-1 text-sm text-flit-negative" role="alert">
						{errors.confirmPassword}
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
					disabled={isSubmitting}
					class="btn btn-primary w-full justify-center py-3 disabled:cursor-not-allowed"
				>
					{#if isSubmitting}
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
						Creating account...
					{:else}
						Create account
					{/if}
				</button>
			</div>

			<!-- Links -->
			<div class="text-center">
				<p class="text-sm text-flit-muted">
					Already have an account?
					<a href={resolve('/login')} class="font-medium text-flit-link transition-opacity hover:opacity-80">
						Sign in here
					</a>
				</p>
			</div>
		</form>
	</div>
</div>
