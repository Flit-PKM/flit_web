<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { apiClient } from '$lib/api/client';
	import { validateResetPasswordForm, sanitizeInput } from '$lib/utils/auth';
	import { captureApiError } from '$lib/utils/error-handler';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import type { FormErrors } from '$lib/types/auth';

	type PageState = 'expired' | 'form' | 'invalid';

	let pageState = $derived.by((): PageState => {
		const params = $page.url.searchParams;
		const token = params.get('token');
		const error = params.get('error');
		if (error === 'expired') return 'expired';
		if (token && token.trim() !== '') return 'form';
		return 'invalid';
	});

	let token = $derived($page.url.searchParams.get('token') ?? '');

	let newPassword = $state('');
	let confirmPassword = $state('');
	let errors: FormErrors = $state({});
	let isSubmitting = $state(false);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let generalError = $state('');

	async function handleSubmit(event: Event) {
		event.preventDefault();
		generalError = '';
		errors = {};

		const validationErrors = validateResetPasswordForm({
			newPassword,
			confirmPassword: confirmPassword || undefined
		});
		if (Object.keys(validationErrors).length > 0) {
			errors = validationErrors;
			return;
		}

		isSubmitting = true;
		try {
			const res = await apiClient.confirmPasswordReset({
				token: token.trim(),
				new_password: newPassword
			});
			if (res.success) {
				goto(resolve('/login') + '?password_reset=success');
			} else {
				generalError = res.detail || 'Failed to reset password. Please request a new link.';
			}
		} catch (err) {
			generalError = captureApiError(err, {
				component: 'ResetPassword',
				operation: 'confirmPasswordReset'
			});
		} finally {
			isSubmitting = false;
		}
	}

	function handleFieldChange(field: 'newPassword' | 'confirmPassword', value: string) {
		const sanitized = sanitizeInput(value);
		if (field === 'newPassword') {
			newPassword = sanitized;
			errors.newPassword = '';
		} else {
			confirmPassword = sanitized;
			errors.confirmPassword = '';
		}
	}

	function togglePasswordVisibility(which: 'new' | 'confirm') {
		if (which === 'new') showPassword = !showPassword;
		else showConfirmPassword = !showConfirmPassword;
	}

	let newPasswordInput = $state<HTMLInputElement | undefined>(undefined);

	onMount(() => {
		newPasswordInput?.focus();
	});
</script>

<svelte:head>
	<title>Reset Password - Flit Web</title>
	<meta name="description" content="Set a new password for your Flit Web account." />
</svelte:head>

<div class="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md">
		<div
			class="rounded-2xl bg-flit-card p-6 shadow-flit-sm backdrop-blur-sm sm:p-8"
			role={pageState === 'form' ? undefined : 'alert'}
		>
			{#if pageState === 'expired'}
				<div class="text-center">
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-flit-negative/20"
						aria-hidden="true"
					>
						<svg
							class="h-8 w-8 text-flit-negative"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h1 class="mt-4 text-2xl font-semibold text-flit-ink">Reset link expired</h1>
					<p class="mt-2 text-sm text-flit-muted">
						This reset link has expired. Please request a new one.
					</p>
					<div class="mt-6">
						<a
							href={resolve('/forgot-password')}
							class="btn btn-primary w-full justify-center px-4"
						>
							Request new reset link
						</a>
					</div>
				</div>
			{:else if pageState === 'invalid'}
				<div class="text-center">
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-flit-muted/20"
						aria-hidden="true"
					>
						<svg
							class="h-8 w-8 text-flit-muted"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h1 class="mt-4 text-2xl font-semibold text-flit-ink">Invalid reset link</h1>
					<p class="mt-2 text-sm text-flit-muted">
						Unable to reset password. The link may be invalid or expired. Please request a new one.
					</p>
					<div class="mt-6 space-y-3">
						<a
							href={resolve('/forgot-password')}
							class="btn btn-primary w-full justify-center px-4"
						>
							Request new reset link
						</a>
						<a href={resolve('/login')} class="btn btn-secondary w-full justify-center px-4">
							Back to sign in
						</a>
					</div>
				</div>
			{:else}
				<!-- Form: Set new password -->
				<div class="text-center">
					<h1 class="text-2xl font-semibold text-flit-ink">Set new password</h1>
					<p class="mt-2 text-sm text-flit-muted">Enter your new password below.</p>
				</div>

				<form class="mt-6 space-y-6" onsubmit={handleSubmit} novalidate>
					<GeneralErrorAlert message={generalError} />

					<div>
						<label for="newPassword" class="mb-2 block text-sm font-medium text-flit-ink">
							New password
						</label>
						<div class="relative">
							<input
								bind:this={newPasswordInput}
								id="newPassword"
								name="newPassword"
								type={showPassword ? 'text' : 'password'}
								autocomplete="new-password"
								required
								minlength="8"
								disabled={isSubmitting}
								class="input pr-10 backdrop-blur-sm transition-colors disabled:cursor-not-allowed"
								class:border-flit-negative={!!errors.newPassword}
								class:focus:ring-flit-negative={!!errors.newPassword}
								class:focus:border-flit-negative={!!errors.newPassword}
								placeholder="At least 8 characters"
								value={newPassword}
								oninput={(e) => handleFieldChange('newPassword', e.currentTarget.value)}
								aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
								aria-invalid={!!errors.newPassword}
							/>
							<button
								type="button"
								class="absolute inset-y-0 right-0 flex items-center pr-3 text-flit-muted transition-opacity hover:opacity-80"
								onclick={() => togglePasswordVisibility('new')}
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
						<p class="mt-1 text-xs text-flit-muted">
							Use at least 8 characters with uppercase, lowercase, number, and special character.
						</p>
						{#if errors.newPassword}
							<p id="newPassword-error" class="mt-1 text-sm text-flit-negative" role="alert">
								{errors.newPassword}
							</p>
						{/if}
					</div>

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
								disabled={isSubmitting}
								class="input pr-10 backdrop-blur-sm transition-colors disabled:cursor-not-allowed"
								class:border-flit-negative={!!errors.confirmPassword}
								class:focus:ring-flit-negative={!!errors.confirmPassword}
								class:focus:border-flit-negative={!!errors.confirmPassword}
								placeholder="Confirm your new password"
								value={confirmPassword}
								oninput={(e) => handleFieldChange('confirmPassword', e.currentTarget.value)}
								aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
								aria-invalid={!!errors.confirmPassword}
							/>
							<button
								type="button"
								class="absolute inset-y-0 right-0 flex items-center pr-3 text-flit-muted transition-opacity hover:opacity-80"
								onclick={() => togglePasswordVisibility('confirm')}
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
							<p id="confirmPassword-error" class="mt-1 text-sm text-flit-negative" role="alert">
								{errors.confirmPassword}
							</p>
						{/if}
					</div>

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
								Updating…
							{:else}
								Update password
							{/if}
						</button>
					</div>

					<div class="text-center">
						<a
							href={resolve('/login')}
							class="text-sm font-medium text-flit-link transition-opacity hover:opacity-80"
						>
							Back to sign in
						</a>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
