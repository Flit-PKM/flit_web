<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, isLoading } from '$lib/stores/auth';
	import {
		getPasswordStrength,
		getPasswordStrengthLabel,
		loginRateLimiter,
		validateLoginForm,
		validateRegisterForm
	} from '$lib/utils/auth';
	import { clearFieldError, toggleFlag, updateSanitizedField } from '$lib/utils/auth-forms';
	import { errorLogger } from '$lib/utils/error-handler';
	import { FormValidator, createDebouncedValidator, validationRules } from '$lib/utils/validation';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import GoogleSignInButton from '$lib/components/GoogleSignInButton.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import type { FormErrors, LoginFormData } from '$lib/types/auth';

	let { autofocusEmail = false }: { autofocusEmail?: boolean } = $props();

	const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
	const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

	let isRegister = $derived.by(() => {
		if (!browser) return false;
		return $page.url.searchParams.get('mode') === 'register';
	});

	let formData: LoginFormData = $state({
		email: '',
		password: ''
	});
	let errors: FormErrors = $state({});
	let generalError = $state('');
	let isSubmitting = $state(false);
	let showPassword = $state(false);
	let offerCreateAccount = $state(false);
	let turnstileReady = $state(!turnstileSiteKey);

	let passwordStrength = $derived(getPasswordStrength(formData.password));
	let passwordStrengthLabel = $derived(getPasswordStrengthLabel(passwordStrength));

	const signInValidator = new FormValidator<LoginFormData>({
		email: { required: true, rules: [validationRules.email()] },
		password: { required: true }
	});
	const registerValidator = new FormValidator<LoginFormData>({
		email: { required: true, rules: [validationRules.email()] },
		password: {
			required: true,
			rules: [validationRules.minLength(8), validationRules.password()]
		}
	});
	const debouncedSignIn = createDebouncedValidator(signInValidator);
	const debouncedRegister = createDebouncedValidator(registerValidator);

	let emailInput: HTMLInputElement | undefined;

	onMount(() => {
		if (autofocusEmail) emailInput?.focus();
	});

	$effect(() => {
		if (!isRegister || !turnstileSiteKey) return;

		const win = window as Window & {
			onTurnstileSuccess?: () => void;
			onTurnstileError?: (code?: string) => void;
		};
		win.onTurnstileSuccess = () => {
			turnstileReady = true;
		};
		win.onTurnstileError = (code?: string) => {
			turnstileReady = false;
			errorLogger.logError(new Error('Turnstile error'), {
				component: 'AuthCredentialsForm',
				operation: 'turnstileError',
				code
			});
		};

		return () => {
			delete win.onTurnstileSuccess;
			delete win.onTurnstileError;
		};
	});

	function handleFieldChange(field: keyof LoginFormData, value: string) {
		const fieldName = String(field);
		updateSanitizedField(formData, fieldName, value);
		clearFieldError(errors, fieldName);

		const debounced = isRegister ? debouncedRegister : debouncedSignIn;
		debounced.validateField(field as string, value, (error) => {
			errors[field] = error || '';
		});
	}

	async function setRegisterMode(register: boolean) {
		const next = new URL($page.url);
		if (register) next.searchParams.set('mode', 'register');
		else next.searchParams.delete('mode');
		offerCreateAccount = false;
		generalError = '';
		errors = {};
		await goto(`${next.pathname}${next.search}${next.hash}` as Parameters<typeof goto>[0], {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		generalError = '';
		isSubmitting = true;

		if (!isRegister && !loginRateLimiter.isAllowed(formData.email)) {
			const remainingTime = Math.ceil(
				loginRateLimiter.getRemainingTime(formData.email) / 1000 / 60
			);
			generalError = `Too many login attempts. Please try again in ${remainingTime} minutes.`;
			isSubmitting = false;
			return;
		}

		const validationErrors = isRegister
			? validateRegisterForm(formData)
			: validateLoginForm(formData);
		if (Object.keys(validationErrors).length > 0) {
			errors = validationErrors;
			isSubmitting = false;
			return;
		}

		if (isRegister) {
			const form = event.target as HTMLFormElement;
			const cfTurnstileResponse = form.querySelector<HTMLInputElement>(
				'[name="cf-turnstile-response"]'
			)?.value;

			const result = await authActions.register({
				email: formData.email,
				password: formData.password,
				cf_turnstile_response: cfTurnstileResponse || null
			});

			if (!result.success) {
				generalError = result.error || 'Registration failed. Please try again.';
				if (typeof turnstile !== 'undefined' && turnstile?.reset) {
					turnstile.reset('register-widget');
					turnstileReady = !turnstileSiteKey;
				}
			}
		} else {
			const result = await authActions.login(formData);
			if (!result.success) {
				loginRateLimiter.recordAttempt(formData.email);
				generalError = result.error || 'Login failed. Please try again.';
				offerCreateAccount = true;
			}
		}

		isSubmitting = false;
	}

	function handleGoogleSuccess() {
		// Redirect handled by the host page $effect when isAuthenticated becomes true.
	}

	function togglePasswordVisibility() {
		showPassword = toggleFlag(showPassword);
	}

	let submitDisabled = $derived(
		isSubmitting ||
			$isLoading ||
			(isRegister && Boolean(turnstileSiteKey) && !turnstileReady)
	);

	let registerHref = $derived.by(() => {
		if (!browser) return `${$page.url.pathname}?mode=register`;
		const next = new URL($page.url);
		next.searchParams.set('mode', 'register');
		return `${next.pathname}${next.search}${next.hash}`;
	});
	let signInHref = $derived.by(() => {
		if (!browser) return $page.url.pathname;
		const next = new URL($page.url);
		next.searchParams.delete('mode');
		return `${next.pathname}${next.search}${next.hash}`;
	});
</script>

<svelte:head>
	{#if isRegister && turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<form onsubmit={handleSubmit} novalidate>
	{#if googleClientId}
		<GoogleSignInButton
			disabled={isSubmitting || $isLoading}
			onSuccess={handleGoogleSuccess}
			onError={(msg: string) => {
				generalError = msg;
			}}
		/>
		<div class="auth__divider auth__divider--google" role="presentation">
			<span class="auth__divider-line" aria-hidden="true"></span>
			<span class="auth__divider-label">or</span>
			<span class="auth__divider-line" aria-hidden="true"></span>
		</div>
	{/if}

	<div class="form-group form-group--inline">
		<label for="email">Email</label>
		<input
			bind:this={emailInput}
			id="email"
			name="email"
			type="email"
			autocomplete="email"
			required
			disabled={isSubmitting}
			class={['input', 'wide', errors.email && 'input--error']}
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

	<div class="form-group form-group--inline">
		<label for="password">Password</label>
		<div class="input-wrap">
			<input
				id="password"
				name="password"
				type={showPassword ? 'text' : 'password'}
				autocomplete={isRegister ? 'new-password' : 'current-password'}
				required
				disabled={isSubmitting}
				class={['input', 'wide', errors.password && 'input--error']}
				placeholder={isRegister ? 'Create a strong password' : 'Enter your password'}
				bind:value={formData.password}
				oninput={(e) => handleFieldChange('password', e.currentTarget.value)}
				aria-describedby={errors.password
					? 'password-error'
					: isRegister
						? 'password-strength'
						: undefined}
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

		{#if isRegister && formData.password}
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

	<GeneralErrorAlert message={generalError} />

	{#if isRegister && turnstileSiteKey}
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
		<button type="submit" disabled={submitDisabled} class="btn btn-primary btn--block">
			{#if isSubmitting || $isLoading}
				<LoadingSpinner class="loading__spinner--mr-md" />
				{isRegister ? 'Creating account…' : 'Signing in…'}
			{:else}
				{isRegister ? 'Create account' : 'Sign in'}
			{/if}
		</button>
	</div>

	{#if !isRegister && offerCreateAccount}
		<button type="button" class="btn btn-secondary btn--block" onclick={() => setRegisterMode(true)}>
			Create account with this email
		</button>
	{/if}

	<div class="auth__links">
		<p class="card__meta">
			{#if isRegister}
				Already have an account?
				<a
					href={signInHref}
					data-sveltekit-noscroll
					data-sveltekit-keepfocus
					onclick={() => {
						offerCreateAccount = false;
						generalError = '';
						errors = {};
					}}>Sign in</a
				>
			{:else}
				Don't have an account?
				<a
					href={registerHref}
					data-sveltekit-noscroll
					data-sveltekit-keepfocus
					onclick={() => {
						offerCreateAccount = false;
						generalError = '';
						errors = {};
					}}>Sign up</a
				>
			{/if}
		</p>
		{#if !isRegister}
			<p class="card__meta">
				<a href={resolve('/forgot-password')}>Forgot your password?</a>
			</p>
		{/if}
	</div>
</form>
