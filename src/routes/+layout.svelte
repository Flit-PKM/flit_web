<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve, asset } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, currentUser, isAuthenticated } from '$lib/stores/auth';
	import { pendingColorScheme } from '$lib/stores/theme';

	let { children } = $props();
	let showMobileMenu = $state(false);

	// Initialize auth state on app start
	onMount(() => {
		authActions.initialize();
	});

	// Apply color scheme to document: pending (unsaved) preference or saved user preference
	$effect(() => {
		if (!browser) return;

		const scheme = $pendingColorScheme ?? $currentUser?.color_scheme ?? 'default';
		const effective =
			scheme === 'light' || scheme === 'dark'
				? scheme
				: window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light';

		document.documentElement.setAttribute('data-color-scheme', effective);

		// When preference is "default", react to system theme changes
		if (scheme !== 'light' && scheme !== 'dark') {
			const mq = window.matchMedia('(prefers-color-scheme: dark)');
			const listener = () => {
				document.documentElement.setAttribute('data-color-scheme', mq.matches ? 'dark' : 'light');
			};
			mq.addEventListener('change', listener);
			return () => mq.removeEventListener('change', listener);
		}
	});

	// Handle logout
	function handleLogout() {
		authActions.logout();
	}

	// Navigation items - only show when authenticated; Dashboard only when superuser (to the right of Profile)
	type NavHref = '/notes' | '/profile' | '/dashboard';
	const baseNavItems: { href: NavHref; label: string }[] = [
		{ href: '/notes', label: 'Notes' },
		{ href: '/profile', label: 'Profile' }
	];
	let navItems = $derived(
		$isAuthenticated
			? $currentUser?.is_superuser
				? [...baseNavItems, { href: '/dashboard' as NavHref, label: 'Dashboard' }]
				: baseNavItems
			: []
	);

	// Close mobile menu when route changes
	$effect(() => {
		void $page.url.pathname;
		showMobileMenu = false;
	});

	// Check if current path matches nav item
	function isActive(href: string): boolean {
		if (href === '/' && $page.url.pathname === '/') {
			return true;
		}
		// /notes is active for /notes and /notes/[id]
		if (
			href === '/notes' &&
			($page.url.pathname === '/notes' || $page.url.pathname.startsWith('/notes/'))
		) {
			return true;
		}
		if (href === '/dashboard' && $page.url.pathname.startsWith('/dashboard')) {
			return true;
		}
		if (href !== '/' && href !== '/notes' && $page.url.pathname.startsWith(href)) {
			return true;
		}
		return false;
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={asset('/images/flit_app_logo.svg')} />
	<title>Flit Web</title>
	<meta
		name="description"
		content="Flit Web – Webapp for Flit-Core. View and manage your notes and insights as a knowledge graph."
	/>
</svelte:head>

<div class="min-h-screen overflow-x-hidden bg-flit-canvas">
	<!-- Navigation -->
	<nav class="border-b border-flit-muted/20 bg-flit-footer shadow-flit-sm">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 justify-between">
				<!-- Logo and Desktop Navigation -->
				<div class="flex">
					<div class="flex flex-shrink-0 items-center">
						<a
							href={resolve('/')}
							class="flex items-center gap-2 text-flit-ink transition-opacity hover:opacity-80"
						>
							<img src={asset('/images/flit_app_logo.svg')} alt="Flit" class="h-8 w-8" />
							<span class="text-xl font-bold">Flit Web</span>
						</a>
					</div>
					<div class="hidden sm:ml-6 sm:flex sm:space-x-8">
						{#each navItems as item (item.href)}
							<a
								href={resolve(item.href)}
								class="inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors {isActive(
									item.href
								)
									? 'border-flit-primary text-flit-ink'
									: 'border-transparent text-flit-muted hover:border-flit-muted/30 hover:text-flit-ink'}"
							>
								{item.label}
							</a>
						{/each}
					</div>
				</div>

				<!-- Desktop Auth Section -->
				<div class="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
					{#if $isAuthenticated && $currentUser}
						<div class="flex items-center space-x-4">
							<span class="text-sm text-flit-ink">
								Welcome, <span class="font-medium">{$currentUser.username}</span>
							</span>
							<button onclick={handleLogout} class="btn btn-secondary"> Sign out </button>
						</div>
					{:else}
						<div class="flex items-center space-x-4">
							<a
								href={resolve('/login')}
								class="rounded-lg px-3 py-2 text-sm font-medium text-flit-muted transition-colors hover:text-flit-ink"
							>
								Sign in
							</a>
							<a href={resolve('/register')} class="btn btn-primary px-4"> Sign up </a>
						</div>
					{/if}
				</div>

				<!-- Mobile menu button -->
				<div class="flex items-center sm:hidden">
					<button
						onclick={() => (showMobileMenu = !showMobileMenu)}
						class="inline-flex items-center justify-center rounded-lg p-2 text-flit-muted transition-colors hover:bg-flit-card hover:text-flit-ink focus:ring-2 focus:ring-flit-primary focus:outline-none focus:ring-inset"
						aria-expanded={showMobileMenu}
						aria-label="Main menu"
					>
						<svg class="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							{#if showMobileMenu}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							{:else}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 6h16M4 12h16M4 18h16"
								/>
							{/if}
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile menu -->
		{#if showMobileMenu}
			<div class="sm:hidden">
				{#if $isAuthenticated}
					<div class="space-y-1 border-t border-flit-muted/20 pt-2 pb-3">
						{#each navItems as item (item.href)}
							<a
								href={resolve(item.href)}
								class="block border-l-4 py-2 pr-4 pl-3 text-base font-medium transition-colors {isActive(
									item.href
								)
									? 'border-flit-primary bg-flit-card text-flit-ink'
									: 'border-transparent text-flit-muted hover:border-flit-muted/30 hover:bg-flit-card hover:text-flit-ink'}"
							>
								{item.label}
							</a>
						{/each}
					</div>
				{/if}
				<div class="border-t border-flit-muted/20 pt-4 pb-3">
					{#if $isAuthenticated && $currentUser}
						<div class="flex items-center px-4">
							<div class="flex-shrink-0">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-flit-primary"
								>
									<span class="text-sm font-medium text-white">
										{$currentUser.email.charAt(0).toUpperCase()}
									</span>
								</div>
							</div>
							<div class="ml-3">
								<div class="text-base font-medium text-flit-ink">
									{$currentUser.email}
								</div>
							</div>
						</div>
						<div class="mt-3 space-y-1">
							<button
								onclick={handleLogout}
								class="block w-full px-4 py-2 text-left text-base font-medium text-flit-muted transition-colors hover:bg-flit-card hover:text-flit-ink"
							>
								Sign out
							</button>
						</div>
					{:else}
						<div class="space-y-1">
							<a
								href={resolve('/login')}
								class="block px-4 py-2 text-base font-medium text-flit-muted transition-colors hover:bg-flit-card hover:text-flit-ink"
							>
								Sign in
							</a>
							<a
								href={resolve('/register')}
								class="block px-4 py-2 text-base font-medium text-flit-link transition-colors hover:bg-flit-card hover:text-flit-ink"
							>
								Sign up
							</a>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</nav>

	<!-- Main content -->
	<main class="relative flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="mt-16 border-t border-flit-muted/20 bg-flit-footer">
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div class="flex flex-col items-center space-y-4">
				<nav class="flex flex-wrap justify-center gap-x-6 gap-y-2">
					<a
						href={resolve('/about')}
						class="text-sm text-flit-muted transition-colors hover:text-flit-ink"
					>
						About
					</a>
					<a
						href={resolve('/terms')}
						class="text-sm text-flit-muted transition-colors hover:text-flit-ink"
					>
						Terms
					</a>
				</nav>
				<p class="text-md text-flit-muted">
					"But seek first the kingdom of God and His righteousness, and all these things shall be
					added to you." - Matthew 6:33
				</p>
				<p class="text-sm text-flit-muted">
					&copy; 2026 Flit-PKM and all related apps are brought to you by
					<a
						href="https://bmd-studios.com"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-flit-link transition-opacity hover:opacity-80"
					>
						BMD-Studios
					</a>
				</p>
			</div>
		</div>
	</footer>
</div>

<style>
	nav a {
		transition: all 0.2s ease-in-out;
	}
</style>
