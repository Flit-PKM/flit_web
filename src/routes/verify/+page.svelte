<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';

	type VerificationState = 'success' | 'expired' | 'unconfigured' | 'unknown';

	let verificationState = $derived.by((): VerificationState => {
		const params = $page.url.searchParams;
		const success = params.get('success');
		const error = params.get('error');
		if (success === '1') return 'success';
		if (success === '0' && error === 'expired') return 'expired';
		if (success === '0' && error === 'unconfigured') return 'unconfigured';
		return 'unknown';
	});
</script>

<svelte:head>
	<title>Email Verification - Flit Web</title>
	<meta name="description" content="Email verification status for your Flit Web account." />
</svelte:head>

<div class="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md">
		<div
			class="rounded-2xl bg-flit-card p-6 shadow-flit-sm backdrop-blur-sm sm:p-8"
			role={verificationState === 'success' ? 'status' : 'alert'}
		>
			{#if verificationState === 'success'}
				<div class="text-center">
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-flit-positive/20"
						aria-hidden="true"
					>
						<svg
							class="h-8 w-8 text-flit-positive"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h1 class="mt-4 text-2xl font-semibold text-flit-ink">Email verified</h1>
					<p class="mt-2 text-sm text-flit-muted">
						Your email address has been verified successfully. You can now sign in to your account.
					</p>
					<div class="mt-6">
						<a href={resolve('/login')} class="btn btn-primary w-full justify-center px-4">
							Sign in
						</a>
					</div>
				</div>
			{:else if verificationState === 'expired'}
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
					<h1 class="mt-4 text-2xl font-semibold text-flit-ink">Verification link expired</h1>
					<p class="mt-2 text-sm text-flit-muted">
						This verification link has expired. Please sign in to request a new verification email,
						or register again if you haven't completed account creation.
					</p>
					<div class="mt-6 space-y-3">
						<a href={resolve('/login')} class="btn btn-primary w-full justify-center px-4">
							Sign in
						</a>
						<a href={resolve('/register')} class="btn btn-secondary w-full justify-center px-4">
							Sign up
						</a>
					</div>
				</div>
			{:else if verificationState === 'unconfigured'}
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
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h1 class="mt-4 text-2xl font-semibold text-flit-ink">
						Email verification not available
					</h1>
					<p class="mt-2 text-sm text-flit-muted">
						Email verification is not configured on this server. Please contact support if you need
						assistance.
					</p>
					<div class="mt-6 space-y-3">
						<a href={resolve('/login')} class="btn btn-primary w-full justify-center px-4">
							Sign in
						</a>
						<a href={resolve('/')} class="btn btn-secondary w-full justify-center px-4">
							Go to home
						</a>
					</div>
				</div>
			{:else}
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
					<h1 class="mt-4 text-2xl font-semibold text-flit-ink">
						Unable to determine verification status
					</h1>
					<p class="mt-2 text-sm text-flit-muted">
						The verification result could not be determined. You can try signing in or registering
						below.
					</p>
					<div class="mt-6 space-y-3">
						<a href={resolve('/login')} class="btn btn-primary w-full justify-center px-4">
							Sign in
						</a>
						<a href={resolve('/register')} class="btn btn-secondary w-full justify-center px-4">
							Sign up
						</a>
						<a
							href={resolve('/')}
							class="text-sm font-medium text-flit-link transition-opacity hover:opacity-80"
						>
							Go to home
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
