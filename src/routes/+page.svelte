<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated, currentUser } from '$lib/stores/auth';
	import { apiClient, HttpError } from '$lib/api/client';

	let billingCompleteStarted = false;

	// Billing return: if subscription_id and status are in URL, POST to backend then redirect. Otherwise normal root redirects.
	$effect(() => {
		const params = $page.url.searchParams;
		const subscriptionId = params.get('subscription_id');
		const status = params.get('status');
		const hasBillingParams = Boolean(subscriptionId && status);

		if (hasBillingParams && $isAuthenticated && !billingCompleteStarted) {
			billingCompleteStarted = true;
			const returnPath = $page.url.pathname + $page.url.search;
			(async () => {
				try {
					await apiClient.postBillingComplete({
						subscription_id: subscriptionId!,
						status: status!
					});
					goto(resolve('/profile') + '?subscription=success');
				} catch (err) {
					if (err instanceof HttpError && err.status === 401) {
						goto(resolve('/login') + '?redirect=' + encodeURIComponent(returnPath));
					} else {
						goto(resolve('/profile') + '?subscription=error');
					}
				}
			})();
			return;
		}

		if (hasBillingParams && !$isAuthenticated) {
			const returnPath = $page.url.pathname + $page.url.search;
			goto(resolve('/login') + '?redirect=' + encodeURIComponent(returnPath));
			return;
		}

		if (!$isAuthenticated) {
			const target = params.get('redirect')?.toLowerCase();
			if (target === 'login') {
				goto(resolve('/login'));
			} else if (target === 'register') {
				goto(resolve('/register'));
			}
			return;
		}

		// Logged in, no billing params: go to Notes
		goto(resolve('/notes'));
	});
</script>

<svelte:head>
	<title>Flit Web – Welcome</title>
</svelte:head>

<header class="hero">
	<h1>Flit</h1>
	<h2>Note Taking & Personal Knowledge Management</h2>
	<p class="card__meta">Butterfly on the web of consciousness, Flutter.</p>
	<p>
		Welcome to the Flit-PKM ecosystem — your secure, personal space to capture thoughts, weave ideas
		together, and let powerful AI gently reveal hidden connections, smart summaries, and fresh
		insights you never expected.
	</p>
</header>

<div>
	<div class="card small">
		{#if $isAuthenticated && $currentUser}
			<div class="landing__stack">
				<div class="landing__avatar" data-tone="positive">
					<svg class="icon_md text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
						/>
					</svg>
				</div>
				<h3>Welcome back, {$currentUser.email}!</h3>
				<p class="card__meta">You are successfully signed in to your account.</p>
				<a href={resolve('/profile')} class="btn btn-primary">View Profile</a>
			</div>
		{:else}
			<div class="landing__stack">
				<div class="landing__avatar" data-tone="muted">
					<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
						/>
					</svg>
				</div>
				<h3>Get Started</h3>
				<p class="card__meta">
					Create an account or sign in to access your knowledge graph and manage your notes.
				</p>
				<div class="landing__cta">
					<a href={resolve('/register')} class="btn btn-primary btn--block">Create Account</a>
					<a href={resolve('/login')} class="btn btn-secondary btn--block">Sign In</a>
				</div>
			</div>
		{/if}
	</div>

	<div class="grid-cards landing__highlights">
		<article class="landing__tile">
			<div class="landing__tile-icon" data-tone="positive">
				<svg class="icon_base" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<h3>Connected Thinking, AI-Powered</h3>
			<p>
				Create your ultimate personal knowledge hub: write notes, weave them together with
				effortless back-and-forth links, organize by topic or project, and summarize on demand. Then
				let AI scan your entire base to surface surprising links, deeper insights, and creative
				connections that help you think bigger and clearer.
			</p>
		</article>

		<article class="landing__tile">
			<div class="landing__tile-icon" data-tone="primary">
				<svg class="icon_base" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
					/>
				</svg>
			</div>
			<h3>Fortress-Level Security for Your Mind</h3>
			<p>
				We take your privacy seriously. Every piece of your knowledge is shielded with
				industry-leading encryption — end-to-end and at rest — so it remains 100% yours and
				unreadable to anyone else. Safe today, safe tomorrow.
			</p>
		</article>

		<article class="landing__tile">
			<div class="landing__tile-icon" data-tone="primary">
				<svg class="icon_base" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
					/>
				</svg>
			</div>
			<h3>Share Ideas Without Limits</h3>
			<p>
				Export your connected knowledge base as standard Markdown files — ideal for collaborating,
				archiving, or using elsewhere. Import Markdown from other apps or friends to expand your
				base instantly. No barriers, no formats to fight — just pure, easy flow of your thoughts.
			</p>
		</article>
	</div>
</div>
