<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient } from '$lib/api/client';
	import { validateForgotPasswordForm, sanitizeInput } from '$lib/utils/auth';
	import { captureApiError } from '$lib/utils/error-handler';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import type { FormErrors } from '$lib/types/auth';

	let email = $state('');
	let errors: FormErrors = $state({});
	let isSubmitting = $state(false);
	let showSuccessMessage = $state(false);
	let cooldownDetail = $state('');
	let generalError = $state('');

	const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
	let turnstileReady = $state(!turnstileSiteKey);

	// Redirect if already authenticated
	$effect(() => {
		if ($isAuthenticated) {
			goto(resolve('/profile'));
		}
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		generalError = '';
		cooldownDetail = '';
		isSubmitting = true;
		showSuccessMessage = false;

		const validationErrors = validateForgotPasswordForm({ email: email.trim() });
		if (Object.keys(validationErrors).length > 0) {
			errors = validationErrors;
			isSubmitting = false;
			return;
		}

		const form = event.target as HTMLFormElement;
		const cfTurnstileResponse = form.querySelector<HTMLInputElement>(
			'[name="cf-turnstile-response"]'
		)?.value;

		try {
			const res = await apiClient.requestPasswordReset(
				email.trim(),
				cfTurnstileResponse || undefined
			);
			// Always show generic success to avoid user enumeration
			showSuccessMessage = true;
			if (typeof turnstile !== 'undefined' && turnstile?.reset) {
				turnstile.reset('forgot-password-widget');
			}
			if (!res.sent && res.detail) {
				cooldownDetail = res.detail;
			}
		} catch (err) {
			generalError = captureApiError(err, {
				component: 'ForgotPassword',
				operation: 'requestPasswordReset'
			});
		} finally {
			isSubmitting = false;
		}
	}

	function handleEmailInput(e: Event) {
		email = sanitizeInput((e.currentTarget as HTMLInputElement).value);
		errors.email = '';
	}

	let emailInput = $state<HTMLInputElement | undefined>(undefined);

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
	<title>Forgot Password - Flit Web</title>
	<meta name="description" content="Request a password reset link for your Flit Web account." />
	{#if turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="auth">
	<div class="auth__inner">
		<div class="auth__header">
			<h1>Forgot password</h1>
			<p>Enter your email and we'll send you a link to reset your password.</p>
		</div>
		<div class="card">
			<form onsubmit={handleSubmit} novalidate>
				{#if showSuccessMessage}
					<div class="alert alert--success" role="status">
						<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<p class="alert__message">
							If an account exists for this email, we've sent a reset link.
						</p>
					</div>
				{/if}

				{#if cooldownDetail}
					<div class="alert alert--error" role="alert">
						<svg class="alert__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<p class="alert__message">{cooldownDetail}</p>
					</div>
				{/if}

				<GeneralErrorAlert message={generalError} />

				{#if !showSuccessMessage}
					<div class="card__row card__row--start">
						<label class="label-inline-end" for="email">Email address</label>
						<input
							bind:this={emailInput}
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							disabled={isSubmitting}
							class="input"
							class:input--error={!!errors.email}
							placeholder="Enter your email"
							value={email}
							oninput={handleEmailInput}
							aria-describedby={errors.email ? 'email-error' : undefined}
							aria-invalid={!!errors.email}
						/>
						{#if errors.email}
							<p id="email-error" role="alert">{errors.email}</p>
						{/if}
					</div>

					{#if turnstileSiteKey}
						<div
							class="cf-turnstile"
							data-sitekey={turnstileSiteKey}
							data-theme="auto"
							data-size="compact"
							data-action="forgot_password"
							data-callback="onTurnstileSuccess"
							data-error-callback="onTurnstileError"
							data-widget-id="forgot-password-widget"
						></div>
					{/if}
				{/if}

				<div class="auth__actions">
					{#if !showSuccessMessage}
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
								Sending…
							{:else}
								Send reset link
							{/if}
						</button>
					{/if}

					<a href={resolve('/login')} class="btn btn-secondary">Back to sign in</a>
				</div>
			</form>
		</div>
	</div>
</div>
