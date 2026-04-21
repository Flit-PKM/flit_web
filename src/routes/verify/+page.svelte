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
<h1>Email Verification</h1>
<div class="card">
	<div role={verificationState === 'success' ? 'status' : 'alert'}>
		{#if verificationState === 'success'}
			<div class="card__row">
				<div class="icon_md" aria-hidden="true">
					<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h2>Email verified</h2>
				<p class="card__meta">
					Your email address has been verified successfully. You can now sign in to your account.
				</p>
				<a href={resolve('/login')} class="btn btn-primary">Sign in</a>
			</div>
		{:else if verificationState === 'expired'}
			<div class="card__column">
				<div class="icon_md" aria-hidden="true">
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h2>Verification link expired</h2>
				<p class="card__meta">
					This verification link has expired. Please sign in to request a new verification email, or
					register again if you haven't completed account creation.
				</p>
				<div class="card__row">
					<a href={resolve('/login')} class="btn btn-primary">Sign in</a>
					<a href={resolve('/register')} class="btn">Sign up</a>
				</div>
			</div>
		{:else if verificationState === 'unconfigured'}
			<div class="card__column">
				<div class="icon_md" aria-hidden="true">
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h2>Email verification not available</h2>
				<p class="card__meta">
					Email verification is not configured on this server. Please contact support if you need
					assistance.
				</p>
				<div class="card__row">
					<a href={resolve('/login')} class="btn btn-primary">Sign in</a>
					<a href={resolve('/register')} class="btn">Sign up</a>
				</div>
			</div>
		{:else}
			<div class="card__column">
				<div class="icon_md" aria-hidden="true">
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h2>Unable to determine verification status</h2>
				<p class="card__meta">
					The verification result could not be determined. You can try signing in or registering
					below.
				</p>
				<div class="card__row">
					<a href={resolve('/login')} class="btn btn-primary">Sign in</a>
					<a href={resolve('/register')} class="btn">Sign up</a>
				</div>
			</div>
		{/if}
	</div>
</div>
