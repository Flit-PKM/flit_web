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

<div class="auth">
	<div class="auth__inner">
		<div class="card" role={pageState === 'form' ? undefined : 'alert'}>
			{#if pageState === 'expired'}
				<div class="auth__header">
					<h1>Reset link expired</h1>
					<p class="card__meta">This reset link has expired. Please request a new one.</p>
					<div class="auth__actions">
						<a href={resolve('/forgot-password')} class="btn btn-primary">
							Request new reset link
						</a>
						<a href={resolve('/login')} class="btn btn-secondary">Back to sign in</a>
					</div>
				</div>
			{:else if pageState === 'invalid'}
				<div class="auth__header">
					<h1>Invalid reset link</h1>
					<p class="card__meta">
						Unable to reset password. The link may be invalid or expired. Please request a new one.
					</p>
					<div class="auth__actions">
						<a href={resolve('/forgot-password')} class="btn btn-primary">
							Request new reset link
						</a>
						<a href={resolve('/login')} class="btn btn-secondary">Back to sign in</a>
					</div>
				</div>
			{:else}
				<div class="auth__header">
					<h1>Set new password</h1>
					<p class="card__meta">Enter your new password below.</p>
				</div>

				<form onsubmit={handleSubmit} novalidate>
					<GeneralErrorAlert message={generalError} />

					<div class="form-group">
						<label for="newPassword">New password</label>
						<div class="input-wrap">
							<input
								bind:this={newPasswordInput}
								id="newPassword"
								name="newPassword"
								type={showPassword ? 'text' : 'password'}
								autocomplete="new-password"
								required
								minlength="8"
								disabled={isSubmitting}
								class="input"
								class:input--error={!!errors.newPassword}
								placeholder="At least 8 characters"
								value={newPassword}
								oninput={(e) => handleFieldChange('newPassword', e.currentTarget.value)}
								aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
								aria-invalid={!!errors.newPassword}
							/>
							<button
								type="button"
								class="input__action"
								onclick={() => togglePasswordVisibility('new')}
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
						<p class="card__meta">
							Use at least 8 characters with uppercase, lowercase, number, and special character.
						</p>
						{#if errors.newPassword}
							<p id="newPassword-error" role="alert">
								{errors.newPassword}
							</p>
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
								disabled={isSubmitting}
								class="input"
								class:input--error={!!errors.confirmPassword}
								placeholder="Confirm your new password"
								value={confirmPassword}
								oninput={(e) => handleFieldChange('confirmPassword', e.currentTarget.value)}
								aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
								aria-invalid={!!errors.confirmPassword}
							/>
							<button
								type="button"
								class="input__action"
								onclick={() => togglePasswordVisibility('confirm')}
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
							<p id="confirmPassword-error" class="form-group__error" role="alert">
								{errors.confirmPassword}
							</p>
						{/if}
					</div>
					<div class="auth__actions">
						<button type="submit" disabled={isSubmitting} class="btn btn-primary">
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
								Updating…
							{:else}
								Update password
							{/if}
						</button>

						<a href={resolve('/login')} class="btn btn-secondary">Back to sign in</a>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
