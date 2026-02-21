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

<div class="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="mb-2 text-3xl font-bold text-flit-ink">Forgot password</h1>
			<p class="text-flit-muted">
				Enter your email and we'll send you a link to reset your password.
			</p>
		</div>

		<!-- Form -->
		<form
			class="mb-4 space-y-6 rounded-2xl bg-flit-card px-6 pt-6 pb-8 shadow-flit-sm backdrop-blur-sm sm:px-8"
			onsubmit={handleSubmit}
			novalidate
		>
			{#if showSuccessMessage}
				<div
					class="rounded-lg border border-flit-positive/30 bg-flit-positive/10 p-4"
					role="status"
				>
					<p class="text-sm text-flit-ink">
						If an account exists for this email, we've sent a reset link.
					</p>
				</div>
			{/if}

			{#if cooldownDetail}
				<div class="rounded-lg border border-flit-negative/30 bg-flit-negative/10 p-4" role="alert">
					<p class="text-sm text-flit-ink">{cooldownDetail}</p>
				</div>
			{/if}

			<GeneralErrorAlert message={generalError} />

			{#if !showSuccessMessage}
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
						class:border-flit-negative={!!errors.email}
						class:focus:ring-flit-negative={!!errors.email}
						class:focus:border-flit-negative={!!errors.email}
						placeholder="Enter your email"
						value={email}
						oninput={handleEmailInput}
						aria-describedby={errors.email ? 'email-error' : undefined}
						aria-invalid={!!errors.email}
					/>
					{#if errors.email}
						<p id="email-error" class="mt-1 text-sm text-flit-negative" role="alert">
							{errors.email}
						</p>
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

				<!-- Submit Button -->
				<div>
					<button
						type="submit"
						disabled={!turnstileReady || isSubmitting}
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
							Sending…
						{:else}
							Send reset link
						{/if}
					</button>
				</div>
			{/if}

			<!-- Links -->
			<div class="text-center">
				<a
					href={resolve('/login')}
					class="text-sm font-medium text-flit-link transition-opacity hover:opacity-80"
				>
					Back to sign in
				</a>
			</div>
		</form>
	</div>
</div>
