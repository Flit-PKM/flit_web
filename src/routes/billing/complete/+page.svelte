<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient } from '$lib/api/client';
	import { HttpError } from '$lib/api/client';
	import type { SubscriptionStatusResponse } from '$lib/types/billing';

	const POLL_INTERVAL_MS = 3000;
	const POLL_TIMEOUT_MS = 30000;

	let phase = $state<'polling' | 'success' | 'pending' | 'error'>('polling');
	let pollError = $state('');

	// Redirect if not authenticated
	$effect(() => {
		if (!$isAuthenticated) {
			goto(resolve('/login') + '?redirect=' + encodeURIComponent('/billing/complete'));
		}
	});

	onMount(() => {
		if (!$isAuthenticated) return;

		let intervalId: ReturnType<typeof setInterval> | null = null;
		const startTime = Date.now();

		const poll = async () => {
			if (Date.now() - startTime >= POLL_TIMEOUT_MS) {
				if (intervalId) clearInterval(intervalId);
				phase = 'pending';
				return;
			}
			try {
				const data: SubscriptionStatusResponse = await apiClient.getSubscription();
				if (data.status === 'active' || data.status === 'trialing') {
					if (intervalId) clearInterval(intervalId);
					phase = 'success';
					return;
				}
			} catch (err) {
				if (err instanceof HttpError && err.status === 401) {
					if (intervalId) clearInterval(intervalId);
					goto(resolve('/login') + '?redirect=' + encodeURIComponent('/billing/complete'));
					return;
				}
				if (intervalId) clearInterval(intervalId);
				phase = 'error';
				pollError = err instanceof Error ? err.message : 'Something went wrong.';
				return;
			}
		};

		// First poll immediately, then every POLL_INTERVAL_MS
		poll();
		intervalId = setInterval(poll, POLL_INTERVAL_MS);

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	});
</script>

<svelte:head>
	<title>Setting up subscription - Flit Web</title>
</svelte:head>

{#if $isAuthenticated}
<div class="px-4 py-12 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-xl">
		<div class="rounded-2xl bg-flit-card p-6 shadow-flit-sm backdrop-blur-sm">
			{#if phase === 'polling'}
				<h1 class="text-xl font-bold text-flit-ink">Setting up your subscription…</h1>
				<p class="mt-2 text-sm text-flit-muted">
					We're confirming your payment. This usually takes a few seconds.
				</p>
				<div class="mt-6 flex justify-center">
					<svg
						class="h-10 w-10 animate-spin text-flit-primary"
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
				</div>
			{:else if phase === 'success'}
				<h1 class="text-xl font-bold text-flit-ink">Subscription active</h1>
				<p class="mt-2 text-sm text-flit-muted">
					Your subscription is now active. You can manage your account from your profile.
				</p>
				<div class="mt-6">
					<a href={resolve('/profile')} class="btn btn-primary px-4">View profile</a>
				</div>
			{:else if phase === 'pending'}
				<h1 class="text-xl font-bold text-flit-ink">Almost there</h1>
				<p class="mt-2 text-sm text-flit-muted">
					If you just subscribed, your plan will appear shortly. You can check your profile in a
					moment.
				</p>
				<div class="mt-6">
					<a href={resolve('/profile')} class="btn btn-primary px-4">Go to profile</a>
				</div>
			{:else if phase === 'error'}
				<h1 class="text-xl font-bold text-flit-ink">Something went wrong</h1>
				<p class="mt-2 text-sm text-flit-muted">{pollError}</p>
				<div class="mt-6">
					<a href={resolve('/profile')} class="btn btn-primary px-4">Back to profile</a>
				</div>
			{/if}
		</div>
	</div>
</div>
{/if}
