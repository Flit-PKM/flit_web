<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { apiClient, HttpError } from '$lib/api/client';
	import { captureApiError } from '$lib/utils/error-handler';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import type { User, UserUpdate, ColorScheme } from '$lib/types/auth';

	const COLOR_SCHEMES: ColorScheme[] = ['default', 'light', 'dark'];

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString();
	}

	let userId = $derived(Number($page.params.id));
	let user = $state<User | null>(null);
	let isLoading = $state(true);
	let error = $state('');
	let successMessage = $state('');

	// Edit form (admin PATCH: username, email, is_active, is_verified, color_scheme — no current_password)
	let editUsername = $state('');
	let editEmail = $state('');
	let editIsActive = $state(true);
	let editIsVerified = $state(false);
	let editColorScheme = $state<ColorScheme>('default');
	let isSaving = $state(false);
	let saveError = $state('');

	// Actions
	let actionLoading = $state(false);
	let actionError = $state('');

	async function fetchUser() {
		if (!Number.isInteger(userId) || userId < 1) {
			error = 'Invalid user.';
			isLoading = false;
			return;
		}
		isLoading = true;
		error = '';
		try {
			user = await apiClient.getUser(userId);
			editUsername = user.username;
			editEmail = user.email;
			editIsActive = user.is_active;
			editIsVerified = user.is_verified;
			editColorScheme = user.color_scheme ?? 'default';
		} catch (err) {
			if (err instanceof HttpError && err.status === 404) {
				error = 'User not found.';
			} else if (err instanceof HttpError && err.status === 403) {
				error = 'Not authorized.';
			} else {
				error = captureApiError(err, { component: 'DashboardUserDetail', operation: 'fetchUser' });
			}
			user = null;
		} finally {
			isLoading = false;
		}
	}

	function applyUser(u: User) {
		user = u;
		editUsername = u.username;
		editEmail = u.email;
		editIsActive = u.is_active;
		editIsVerified = u.is_verified;
		editColorScheme = u.color_scheme ?? 'default';
	}

	async function saveUser() {
		if (!user) return;
		isSaving = true;
		saveError = '';
		successMessage = '';
		try {
			const body: UserUpdate = {
				username: editUsername,
				email: editEmail,
				is_active: editIsActive,
				is_verified: editIsVerified,
				color_scheme: editColorScheme
			};
			const updated = await apiClient.updateUser(user.id, body);
			applyUser(updated);
			successMessage = 'User updated.';
			setTimeout(() => (successMessage = ''), 4000);
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'DashboardUserDetail',
				operation: 'updateUser'
			});
		} finally {
			isSaving = false;
		}
	}

	async function grantSuperuser() {
		if (!user) return;
		if (!confirm(`Grant superuser to ${user.username}?`)) return;
		actionLoading = true;
		actionError = '';
		successMessage = '';
		try {
			const updated = await apiClient.grantSuperuser(user.id);
			applyUser(updated);
			successMessage = 'Superuser granted.';
			setTimeout(() => (successMessage = ''), 4000);
		} catch (err) {
			if (err instanceof HttpError && err.status === 403) {
				actionError = 'Not authorized.';
			} else if (err instanceof HttpError && err.status === 404) {
				actionError = 'User not found.';
			} else {
				actionError = captureApiError(err, {
					component: 'DashboardUserDetail',
					operation: 'grantSuperuser'
				});
			}
		} finally {
			actionLoading = false;
		}
	}

	async function revokeSuperuser() {
		if (!user) return;
		if (!confirm(`Revoke superuser from ${user.username}? This cannot be undone from this screen.`))
			return;
		actionLoading = true;
		actionError = '';
		successMessage = '';
		try {
			const updated = await apiClient.revokeSuperuser(user.id);
			applyUser(updated);
			successMessage = 'Superuser revoked.';
			setTimeout(() => (successMessage = ''), 4000);
		} catch (err) {
			if (err instanceof HttpError && err.status === 403) {
				actionError = 'Not authorized.';
			} else if (err instanceof HttpError && err.status === 404) {
				actionError = 'User not found.';
			} else {
				actionError = captureApiError(err, {
					component: 'DashboardUserDetail',
					operation: 'revokeSuperuser'
				});
			}
		} finally {
			actionLoading = false;
		}
	}

	async function deleteUser() {
		if (!user) return;
		if (!confirm(`Delete user "${user.username}" (${user.email})? This cannot be undone.`)) return;
		actionLoading = true;
		actionError = '';
		try {
			await apiClient.deleteUser(user.id);
			goto(resolve('/dashboard'));
		} catch (err) {
			if (err instanceof HttpError && err.status === 404) {
				actionError = 'User not found.';
			} else if (err instanceof HttpError && err.status === 403) {
				actionError = 'Not authorized.';
			} else {
				actionError = captureApiError(err, {
					component: 'DashboardUserDetail',
					operation: 'deleteUser'
				});
			}
		} finally {
			actionLoading = false;
		}
	}

	onMount(() => {
		fetchUser();
	});
</script>

<svelte:head>
	<title>User {user?.username ?? $page.params.id} – Superuser dashboard – Flit Web</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<a href={resolve('/dashboard')} class="text-sm font-medium text-flit-link hover:underline">
		← Back to dashboard
	</a>

	{#if isLoading}
		<div class="mt-6 flex items-center gap-2 py-8 text-flit-muted">
			<svg
				class="h-6 w-6 animate-spin"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			Loading user…
		</div>
	{:else if error || !user}
		<div class="mt-6 rounded-lg border border-flit-negative/30 bg-flit-negative/10 p-4">
			<p class="text-flit-ink">{error || 'User not found.'}</p>
		</div>
	{:else}
		<h1 class="mt-6 text-2xl font-bold text-flit-ink">User: {user.username}</h1>

		{#if successMessage}
			<div
				class="mt-4 rounded-lg border border-flit-positive/30 bg-flit-positive/10 p-4"
				role="alert"
			>
				<p class="text-sm text-flit-ink">{successMessage}</p>
			</div>
		{/if}
		<GeneralErrorAlert message={actionError} />
		<GeneralErrorAlert message={saveError} />

		<!-- Read-only summary -->
		<div
			class="mt-6 overflow-x-auto rounded-xl border border-flit-muted/20 bg-flit-card p-4 shadow-flit-sm"
		>
			<h2 class="text-lg font-semibold text-flit-ink">Details</h2>
			<dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
				<dt class="text-flit-muted">ID</dt>
				<dd class="text-flit-ink">{user.id}</dd>
				<dt class="text-flit-muted">Username</dt>
				<dd class="text-flit-ink">{user.username}</dd>
				<dt class="text-flit-muted">Email</dt>
				<dd class="text-flit-ink">{user.email}</dd>
				<dt class="text-flit-muted">Active</dt>
				<dd class="text-flit-ink">{user.is_active ? 'Yes' : 'No'}</dd>
				<dt class="text-flit-muted">Verified</dt>
				<dd class="text-flit-ink">{user.is_verified ? 'Yes' : 'No'}</dd>
				<dt class="text-flit-muted">Superuser</dt>
				<dd class="text-flit-ink">{user.is_superuser ? 'Yes' : 'No'}</dd>
				<dt class="text-flit-muted">Color scheme</dt>
				<dd class="text-flit-ink">{user.color_scheme ?? 'default'}</dd>
				<dt class="text-flit-muted">Created</dt>
				<dd class="text-flit-ink">{formatDate(user.created_at)}</dd>
				<dt class="text-flit-muted">Updated</dt>
				<dd class="text-flit-ink">{formatDate(user.updated_at)}</dd>
			</dl>
			{#if user.subscription}
				<h3 class="text-md mt-4 font-medium text-flit-ink">Subscription</h3>
				<dl class="mt-2 grid gap-2 text-sm sm:grid-cols-2">
					<dt class="text-flit-muted">Status</dt>
					<dd class="text-flit-ink">{user.subscription.status ?? '—'}</dd>
					<dt class="text-flit-muted">Current period end</dt>
					<dd class="text-flit-ink">
						{user.subscription.current_period_end
							? formatDate(user.subscription.current_period_end)
							: '—'}
					</dd>
					<dt class="text-flit-muted">Dodo subscription ID</dt>
					<dd class="font-mono text-xs text-flit-ink">
						{user.subscription.dodo_subscription_id ?? '—'}
					</dd>
				</dl>
			{:else}
				<p class="mt-4 text-sm text-flit-muted">No subscription.</p>
			{/if}
		</div>

		<!-- Admin update form -->
		<div class="mt-8 rounded-xl border border-flit-muted/20 bg-flit-card p-4 shadow-flit-sm">
			<h2 class="text-lg font-semibold text-flit-ink">Update user</h2>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveUser();
				}}
				class="mt-4 space-y-4"
			>
				<div>
					<label for="edit-username" class="mb-1 block text-sm font-medium text-flit-ink">
						Username
					</label>
					<input
						id="edit-username"
						type="text"
						bind:value={editUsername}
						class="input w-full max-w-md"
						disabled={isSaving}
					/>
				</div>
				<div>
					<label for="edit-email" class="mb-1 block text-sm font-medium text-flit-ink">
						Email
					</label>
					<input
						id="edit-email"
						type="email"
						bind:value={editEmail}
						class="input w-full max-w-md"
						disabled={isSaving}
					/>
				</div>
				<div class="flex items-center gap-4">
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={editIsActive} disabled={isSaving} class="input" />
						<span class="text-sm text-flit-ink">Active</span>
					</label>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={editIsVerified}
							disabled={isSaving}
							class="input"
						/>
						<span class="text-sm text-flit-ink">Verified</span>
					</label>
				</div>
				<div>
					<label for="edit-color-scheme" class="mb-1 block text-sm font-medium text-flit-ink">
						Color scheme
					</label>
					<select
						id="edit-color-scheme"
						bind:value={editColorScheme}
						class="input w-auto"
						disabled={isSaving}
					>
						{#each COLOR_SCHEMES as cs (cs)}
							<option value={cs}>{cs}</option>
						{/each}
					</select>
				</div>
				<button type="submit" class="btn btn-primary" disabled={isSaving}>
					{isSaving ? 'Saving…' : 'Save changes'}
				</button>
			</form>
		</div>

		<!-- Superuser actions -->
		<div class="mt-8 rounded-xl border border-flit-muted/20 bg-flit-card p-4 shadow-flit-sm">
			<h2 class="text-lg font-semibold text-flit-ink">Superuser</h2>
			<div class="mt-3 flex flex-wrap gap-3">
				{#if user.is_superuser}
					<button
						type="button"
						class="btn btn-secondary"
						disabled={actionLoading}
						onclick={revokeSuperuser}
					>
						{actionLoading ? 'Working…' : 'Revoke superuser'}
					</button>
				{:else}
					<button
						type="button"
						class="btn btn-secondary"
						disabled={actionLoading}
						onclick={grantSuperuser}
					>
						{actionLoading ? 'Working…' : 'Grant superuser'}
					</button>
				{/if}
			</div>
		</div>

		<!-- Delete -->
		<div class="mt-8 rounded-xl border border-flit-negative/20 bg-flit-negative/5 p-4">
			<h2 class="text-lg font-semibold text-flit-ink">Danger zone</h2>
			<p class="mt-2 text-sm text-flit-muted">
				Permanently delete this user. This cannot be undone.
			</p>
			<button
				type="button"
				class="btn mt-3 border-flit-negative text-flit-negative hover:bg-flit-negative/10"
				disabled={actionLoading}
				onclick={deleteUser}
			>
				{actionLoading ? 'Working…' : 'Delete user'}
			</button>
		</div>
	{/if}
</div>
