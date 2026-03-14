<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiClient } from '$lib/api/client';
	import { captureApiError } from '$lib/utils/error-handler';
	import GeneralErrorAlert from '$lib/components/GeneralErrorAlert.svelte';
	import type { User } from '$lib/types/auth';
	import type { AccessCodeCreateResponse, SubscriptionRead } from '$lib/types/admin';
	import type { FeedbackRead } from '$lib/types/feedback';

	const PAGE_SIZES = [10, 25, 50] as const;

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString();
	}

	// ——— Users ———
	let usersLoading = $state(true);
	let usersError = $state('');
	let users = $state<User[]>([]);
	let usersTotal = $state(0);
	let usersSkip = $state(0);
	let usersLimit = $state(10);
	let usersHasMore = $derived(users.length === usersLimit || usersSkip + users.length < usersTotal);
	let usersHasPrev = $derived(usersSkip > 0);

	async function fetchUsers() {
		usersLoading = true;
		usersError = '';
		try {
			const res = await apiClient.getUsers({ skip: usersSkip, limit: usersLimit });
			users = res.items;
			usersTotal = res.total;
		} catch (err) {
			usersError = captureApiError(err, { component: 'Dashboard', operation: 'fetchUsers' });
		} finally {
			usersLoading = false;
		}
	}

	function usersNext() {
		usersSkip += usersLimit;
		fetchUsers();
	}
	function usersPrev() {
		usersSkip = Math.max(0, usersSkip - usersLimit);
		fetchUsers();
	}
	function usersPageSizeChange(e: Event) {
		const v = (e.target as HTMLSelectElement).value;
		usersLimit = Math.min(50, Math.max(10, parseInt(v, 10) || 10));
		usersSkip = 0;
		fetchUsers();
	}

	// ——— Subscriptions ———
	let subsLoading = $state(true);
	let subsError = $state('');
	let subscriptions = $state<SubscriptionRead[]>([]);
	let subsSkip = $state(0);
	let subsLimit = $state(50);
	let subsHasMore = $derived(subscriptions.length === subsLimit);
	let subsHasPrev = $derived(subsSkip > 0);

	async function fetchSubscriptions() {
		subsLoading = true;
		subsError = '';
		try {
			const list = await apiClient.getSubscriptions({ skip: subsSkip, limit: subsLimit });
			subscriptions = list;
		} catch (err) {
			subsError = captureApiError(err, { component: 'Dashboard', operation: 'fetchSubscriptions' });
		} finally {
			subsLoading = false;
		}
	}

	function subsNext() {
		subsSkip += subsLimit;
		fetchSubscriptions();
	}
	function subsPrev() {
		subsSkip = Math.max(0, subsSkip - subsLimit);
		fetchSubscriptions();
	}

	// ——— Feedback ———
	let feedbackLoading = $state(true);
	let feedbackError = $state('');
	let feedbackList = $state<FeedbackRead[]>([]);
	let feedbackSkip = $state(0);
	let feedbackLimit = $state(50);
	let feedbackDeletingId = $state<number | null>(null);
	let feedbackHasMore = $derived(feedbackList.length === feedbackLimit);
	let feedbackHasPrev = $derived(feedbackSkip > 0);

	async function fetchFeedback() {
		feedbackLoading = true;
		feedbackError = '';
		try {
			feedbackList = await apiClient.listFeedback({
				skip: feedbackSkip,
				limit: feedbackLimit
			});
		} catch (err) {
			feedbackError = captureApiError(err, {
				component: 'Dashboard',
				operation: 'fetchFeedback'
			});
		} finally {
			feedbackLoading = false;
		}
	}

	function feedbackNext() {
		feedbackSkip += feedbackLimit;
		fetchFeedback();
	}
	function feedbackPrev() {
		feedbackSkip = Math.max(0, feedbackSkip - feedbackLimit);
		fetchFeedback();
	}

	async function deleteFeedbackItem(id: number) {
		if (!confirm('Delete this feedback?')) return;
		feedbackDeletingId = id;
		try {
			await apiClient.deleteFeedback(id);
			feedbackList = feedbackList.filter((f) => f.id !== id);
		} catch (err) {
			feedbackError = captureApiError(err, {
				component: 'Dashboard',
				operation: 'deleteFeedback'
			});
		} finally {
			feedbackDeletingId = null;
		}
	}

	const TRUNCATE_LEN = 30;

	function truncate(str: string, len: number = TRUNCATE_LEN): string {
		if (!str) return '—';
		return str.length <= len ? str : str.slice(0, len - 1) + '…';
	}

	function formatContext(ctx: Record<string, unknown> | null | undefined, maxLen?: number): string {
		if (!ctx || Object.keys(ctx).length === 0) return '—';
		try {
			const s = maxLen !== undefined ? JSON.stringify(ctx) : JSON.stringify(ctx, null, 2);
			if (maxLen !== undefined) return truncate(s, maxLen);
			return s;
		} catch {
			return '—';
		}
	}

	let feedbackExpandedIds = $state<Set<number>>(new Set());

	function toggleFeedbackExpanded(id: number) {
		feedbackExpandedIds = new Set(feedbackExpandedIds);
		if (feedbackExpandedIds.has(id)) {
			feedbackExpandedIds.delete(id);
		} else {
			feedbackExpandedIds.add(id);
		}
	}

	// ——— Access codes ———
	let codePeriodWeeks = $state(4);
	let codeIncludesEncryption = $state(false);
	let codeValidationError = $state('');
	let codeCreating = $state(false);
	let codeError = $state('');
	let createdCode = $state<AccessCodeCreateResponse | null>(null);
	let codeCopied = $state(false);

	async function createCode() {
		codeValidationError = '';
		codeError = '';
		createdCode = null;
		if (codePeriodWeeks < 1 || codePeriodWeeks > 52) {
			codeValidationError = 'Period must be between 1 and 52 weeks.';
			return;
		}
		codeCreating = true;
		try {
			const res = await apiClient.createAccessCode({
				period_weeks: codePeriodWeeks,
				includes_encryption: codeIncludesEncryption
			});
			createdCode = res;
		} catch (err) {
			codeError = captureApiError(err, { component: 'Dashboard', operation: 'createAccessCode' });
		} finally {
			codeCreating = false;
		}
	}

	async function copyCode() {
		if (!createdCode?.code) return;
		try {
			await navigator.clipboard.writeText(createdCode.code);
			codeCopied = true;
			setTimeout(() => (codeCopied = false), 2000);
		} catch {
			codeError = 'Could not copy to clipboard.';
		}
	}

	onMount(() => {
		fetchUsers();
		fetchSubscriptions();
		fetchFeedback();
	});
</script>

<svelte:head>
	<title>Superuser dashboard – Flit Web</title>
	<meta
		name="description"
		content="Superuser dashboard: users, newsletter subscriptions, feedback, access codes."
	/>
</svelte:head>

<!-- Protected page layout: mx-auto max-w-* px-4 py-8 sm:px-6 lg:px-8 -->
<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<h1 class="text-2xl font-bold text-flit-ink sm:text-3xl">Superuser dashboard</h1>

	<!-- Users -->
	<section class="mt-10" id="users">
		<h2 class="text-lg font-semibold text-flit-ink">Users</h2>
		<div class="mt-2 flex flex-wrap items-center gap-2">
			<label for="users-page-size" class="text-sm text-flit-muted">Page size:</label>
			<select
				id="users-page-size"
				class="input w-auto"
				value={usersLimit}
				onchange={usersPageSizeChange}
				disabled={usersLoading}
			>
				{#each PAGE_SIZES as size (size)}
					<option value={size}>{size}</option>
				{/each}
			</select>
			{#if !usersLoading && usersTotal > 0}
				<span class="text-sm text-flit-muted">
					Showing {usersSkip + 1}–{usersSkip + users.length} of {usersTotal}
				</span>
			{/if}
		</div>
		<GeneralErrorAlert message={usersError} />
		{#if usersLoading}
			<div class="mt-4 flex items-center gap-2 py-4 text-flit-muted">
				<svg
					class="h-5 w-5 animate-spin"
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
				Loading users…
			</div>
		{:else if users.length === 0 && !usersError}
			<p class="mt-4 text-flit-muted">No users found.</p>
		{:else if users.length > 0}
			<div
				class="mt-4 overflow-x-auto rounded-xl border border-flit-muted/20 bg-flit-card shadow-flit-sm"
			>
				<table class="min-w-full divide-y divide-flit-muted/20 text-left text-sm">
					<thead class="bg-flit-muted/5">
						<tr>
							<th class="px-4 py-3 font-medium text-flit-ink">ID</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Username</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Email</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Active</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Verified</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Superuser</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Created</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Subscription</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-flit-muted/10">
						{#each users as user (user.id)}
							<tr class="hover:bg-flit-muted/5">
								<td class="px-4 py-2 text-flit-muted">{user.id}</td>
								<td class="px-4 py-2 font-medium text-flit-ink">{user.username}</td>
								<td class="px-4 py-2 text-flit-ink">{user.email}</td>
								<td class="px-4 py-2">{user.is_active ? 'Yes' : 'No'}</td>
								<td class="px-4 py-2">{user.is_verified ? 'Yes' : 'No'}</td>
								<td class="px-4 py-2">{user.is_superuser ? 'Yes' : 'No'}</td>
								<td class="px-4 py-2 text-flit-muted">{formatDate(user.created_at)}</td>
								<td class="px-4 py-2 text-flit-muted">
									{#if user.subscription?.status}
										{user.subscription.status}
										{#if user.subscription.current_period_end}
											<br /><span class="text-xs"
												>until {formatDate(user.subscription.current_period_end)}</span
											>
										{/if}
									{:else}
										—
									{/if}
								</td>
								<td class="px-4 py-2">
									<a
										href={resolve(`/dashboard/users/${user.id}`)}
										class="font-medium text-flit-link hover:underline"
									>
										View
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-3 flex items-center gap-2">
				<button
					type="button"
					class="btn btn-secondary"
					disabled={!usersHasPrev}
					onclick={usersPrev}
				>
					Previous
				</button>
				<button
					type="button"
					class="btn btn-secondary"
					disabled={!usersHasMore}
					onclick={usersNext}
				>
					Next
				</button>
			</div>
		{/if}
	</section>

	<!-- Newsletter subscriptions -->
	<section class="mt-12" id="subscriptions">
		<h2 class="text-lg font-semibold text-flit-ink">Newsletter subscriptions</h2>
		<GeneralErrorAlert message={subsError} />
		{#if subsLoading}
			<div class="mt-4 flex items-center gap-2 py-4 text-flit-muted">
				<svg
					class="h-5 w-5 animate-spin"
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
				Loading subscriptions…
			</div>
		{:else if subscriptions.length === 0 && !subsError}
			<p class="mt-4 text-flit-muted">No subscriptions.</p>
		{:else if subscriptions.length > 0}
			<div
				class="mt-4 overflow-x-auto rounded-xl border border-flit-muted/20 bg-flit-card shadow-flit-sm"
			>
				<table class="min-w-full divide-y divide-flit-muted/20 text-left text-sm">
					<thead class="bg-flit-muted/5">
						<tr>
							<th class="px-4 py-3 font-medium text-flit-ink">ID</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Email</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Created</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-flit-muted/10">
						{#each subscriptions as sub (sub.id)}
							<tr class="hover:bg-flit-muted/5">
								<td class="px-4 py-2 text-flit-muted">{sub.id}</td>
								<td class="px-4 py-2 text-flit-ink">{sub.email}</td>
								<td class="px-4 py-2 text-flit-muted">{formatDate(sub.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-3 flex items-center gap-2">
				<button type="button" class="btn btn-secondary" disabled={!subsHasPrev} onclick={subsPrev}>
					Previous
				</button>
				<button type="button" class="btn btn-secondary" disabled={!subsHasMore} onclick={subsNext}>
					Next
				</button>
			</div>
		{/if}
	</section>

	<!-- Feedback -->
	<section class="mt-12" id="feedback">
		<h2 class="text-lg font-semibold text-flit-ink">Feedback</h2>
		<GeneralErrorAlert message={feedbackError} />
		{#if feedbackLoading}
			<div class="mt-4 flex items-center gap-2 py-4 text-flit-muted">
				<svg
					class="h-5 w-5 animate-spin"
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
				Loading feedback…
			</div>
		{:else if feedbackList.length === 0 && !feedbackError}
			<p class="mt-4 text-flit-muted">No feedback.</p>
		{:else if feedbackList.length > 0}
			<div
				class="mt-4 overflow-x-auto rounded-xl border border-flit-muted/20 bg-flit-card shadow-flit-sm"
			>
				<table class="min-w-full divide-y divide-flit-muted/20 text-left text-sm">
					<thead class="bg-flit-muted/5">
						<tr>
							<th class="px-4 py-3 font-medium text-flit-ink">ID</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Content</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Context</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Created</th>
							<th class="px-4 py-3 font-medium text-flit-ink">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-flit-muted/10">
						{#each feedbackList as item (item.id)}
							{@const isExpanded = feedbackExpandedIds.has(item.id)}
							<tr
								class="cursor-pointer hover:bg-flit-muted/5"
								role="button"
								tabindex="0"
								onclick={() => toggleFeedbackExpanded(item.id)}
								onkeydown={(e) => e.key === 'Enter' && toggleFeedbackExpanded(item.id)}
							>
								<td class="px-4 py-2 text-flit-muted">
									<span class="inline-flex items-center gap-1">
										{#if isExpanded}
											<svg
												class="h-4 w-4 shrink-0"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												aria-hidden="true"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 15l7-7 7 7"
												/>
											</svg>
										{:else}
											<svg
												class="h-4 w-4 shrink-0"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												aria-hidden="true"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										{/if}
										{item.id}
									</span>
								</td>
								<td class="max-w-[150px] overflow-hidden px-4 py-2 text-flit-ink">
									{truncate(item.content, 30)}
								</td>
								<td class="max-w-[150px] overflow-hidden px-4 py-2 text-flit-muted">
									{formatContext(item.context, 30)}
								</td>
								<td class="px-4 py-2 text-flit-muted">{formatDate(item.created_at)}</td>
								<td class="px-4 py-2" onclick={(e) => e.stopPropagation()} role="cell">
									<button
										type="button"
										class="btn btn-secondary text-sm"
										disabled={feedbackDeletingId === item.id}
										onclick={() => deleteFeedbackItem(item.id)}
										aria-label="Delete feedback"
									>
										{#if feedbackDeletingId === item.id}
											<svg
												class="h-4 w-4 animate-spin"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												aria-hidden="true"
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
										{:else}
											Delete
										{/if}
									</button>
								</td>
							</tr>
							{#if isExpanded}
								<tr>
									<td colspan="5" class="p-0">
										<div class="space-y-3 border-t border-flit-muted/20 bg-flit-muted/5 px-4 py-3">
											<div>
												<div class="text-xs font-medium text-flit-muted">Content</div>
												<div class="mt-1 text-sm break-words whitespace-pre-wrap text-flit-ink">
													{item.content}
												</div>
											</div>
											<div>
												<div class="text-xs font-medium text-flit-muted">Context</div>
												<div
													class="mt-1 font-mono text-sm break-words whitespace-pre-wrap text-flit-ink"
												>
													{formatContext(item.context)}
												</div>
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-3 flex items-center gap-2">
				<button
					type="button"
					class="btn btn-secondary"
					disabled={!feedbackHasPrev}
					onclick={feedbackPrev}
				>
					Previous
				</button>
				<button
					type="button"
					class="btn btn-secondary"
					disabled={!feedbackHasMore}
					onclick={feedbackNext}
				>
					Next
				</button>
			</div>
		{/if}
	</section>

	<!-- Access codes -->
	<section class="mt-12" id="access-codes">
		<h2 class="text-lg font-semibold text-flit-ink">Create access code</h2>
		<p class="mt-1 text-sm text-flit-muted">
			Creates a single-use code. Period 1–52 weeks; optionally include encryption tier.
		</p>
		<div class="mt-4 rounded-xl border border-flit-muted/20 bg-flit-card p-4 shadow-flit-sm">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					createCode();
				}}
				class="flex flex-wrap items-end gap-4"
			>
				<div>
					<label for="period-weeks" class="mb-1 block text-sm font-medium text-flit-ink">
						Period (weeks)
					</label>
					<input
						id="period-weeks"
						type="number"
						min="1"
						max="52"
						bind:value={codePeriodWeeks}
						class="input w-24"
						disabled={codeCreating}
					/>
				</div>
				<div class="flex items-center gap-2">
					<input
						id="includes-encryption"
						type="checkbox"
						bind:checked={codeIncludesEncryption}
						disabled={codeCreating}
						class="h-4 w-4 rounded border-flit-muted text-flit-primary focus:ring-flit-primary"
					/>
					<label for="includes-encryption" class="text-sm font-medium text-flit-ink">
						Includes encryption
					</label>
				</div>
				<button type="submit" class="btn btn-primary" disabled={codeCreating}>
					{codeCreating ? 'Creating…' : 'Create code'}
				</button>
			</form>
			{#if codeValidationError}
				<p class="mt-2 text-sm text-flit-negative" role="alert">{codeValidationError}</p>
			{/if}
			<GeneralErrorAlert message={codeError} />
		</div>

		{#if createdCode}
			<div
				class="mt-4 rounded-xl border border-flit-positive/30 bg-flit-positive/10 p-4"
				role="alert"
			>
				<p class="text-sm font-medium text-flit-ink">
					Code created (single-use; it will not be shown again):
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<code class="rounded bg-flit-card px-2 py-1 font-mono text-sm text-flit-ink"
						>{createdCode.code}</code
					>
					<button type="button" onclick={copyCode} class="btn btn-secondary text-sm">
						{codeCopied ? 'Copied!' : 'Copy'}
					</button>
				</div>
				<p class="mt-2 text-sm text-flit-muted">
					Period: {createdCode.period_weeks} week(s). Includes encryption: {createdCode.includes_encryption
						? 'Yes'
						: 'No'}.
				</p>
				<p class="mt-1 text-sm font-medium text-flit-negative">
					This code is single-use and will not be shown again. Copy it now if needed.
				</p>
			</div>
		{/if}
	</section>
</div>
