<script lang="ts">
	import { authActions, currentUser } from '$lib/stores/auth';
	import { apiClient } from '$lib/api/client';
	import { captureApiError } from '$lib/utils/error-handler';
	import { formatProfileDate } from '$lib/utils/profile';

	let accessCodeInput = $state('');
	let accessCodeActivating = $state(false);
	let accessCodeError = $state('');
	let accessCodeSuccess = $state('');

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
				component: 'AccessCodeSection',
				operation: 'activateAccessCode'
			});
		} finally {
			accessCodeActivating = false;
		}
	}
</script>

<div class="card">
	<h2>Access Code</h2>
	{#if $currentUser?.access_grant}
		<div class="alert alert--success card__block" role="status">
			<p class="card__label">
				Access active until {formatProfileDate($currentUser.access_grant.expires_at)}
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
