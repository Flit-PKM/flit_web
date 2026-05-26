<script lang="ts">
	import '../css/style.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve, asset } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, currentUser, isAuthenticated } from '$lib/stores/auth';
	import { pendingColorScheme } from '$lib/stores/theme';
	import { initializeLogging } from '$lib/utils/log-config';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	const isProd = import.meta.env.MODE === 'production';

	let { children } = $props();
	let showMobileMenu = $state(false);

	function closeMobileMenu() {
		showMobileMenu = false;
	}

	function handleMobileMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeMobileMenu();
	}

	let isLoggedIn = $derived($isAuthenticated && $currentUser);

	// Initialize auth state on app start
	onMount(() => {
		initializeLogging();
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

	type NavHref = '/notes' | '/profile' | '/about' | '/terms' | '/billing';
	const authNavItems: { href: NavHref; label: string }[] = [
		{ href: '/notes', label: 'Notes' },
		{ href: '/profile', label: 'Profile' }
	];
	const guestNavItems: { href: NavHref; label: string }[] = [
		{ href: '/about', label: 'About' },
		{ href: '/terms', label: 'Terms' },
		{ href: '/billing', label: 'Billing' }
	];
	let centerNavItems = $derived($isAuthenticated ? authNavItems : guestNavItems);

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
		if (href !== '/' && href !== '/notes' && $page.url.pathname.startsWith(href)) {
			return true;
		}
		if (href === '/billing' && $page.url.pathname === '/billing') {
			return true;
		}
		if (href === '/about' && $page.url.pathname === '/about') {
			return true;
		}
		if (href === '/terms' && $page.url.pathname === '/terms') {
			return true;
		}
		return false;
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={asset('/images/flit_app_logo.svg')} />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />
	<link rel="canonical" href="https://core.flit-pkm.com/" />

	<title>Flit Web</title>
	<meta
		name="description"
		content="Flit - Note Taking & Personal Knowledge Management. Create, Edit and Delete notes, build Relationships and Categorize them for easy navigation and summarization. Part of the Flit-PKM ecosystem."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Flit Core" />
	<meta property="og:title" content="Flit" />
	<meta
		property="og:description"
		content="Flit - Note Taking & Personal Knowledge Management. Create, Edit and Delete notes, build Relationships and Categorize them for easy navigation and summarization. Part of the Flit-PKM ecosystem."
	/>
	<meta property="og:url" content="https://core.flit-pkm.com/" />
	<meta property="og:image" content="https://core.flit-pkm.com/images/flit_core_logo.svg" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Flit" />
	<meta
		name="twitter:description"
		content="Flit - Note Taking & Personal Knowledge Management. Create, Edit and Delete notes, build Relationships and Categorize them for easy navigation and summarization. Part of the Flit-PKM ecosystem."
	/>
	<meta name="twitter:image" content="https://core.flit-pkm.com/images/flit_core_logo.svg" />

	{#if isProd}
		<script
			defer
			src="https://analytics.bmd-studios.com/script.js"
			data-website-id="90bda04d-f880-47b0-ada3-2f54db6d45bb"
		></script>
	{/if}
</svelte:head>

<svelte:window onkeydown={handleMobileMenuKeydown} />

<div class="app">
	<nav>
		<div class="nav__container">
			<a href={resolve('/')} class="nav__brand">
				<img src={asset('/images/flit_app_logo.svg')} alt="Flit" class="icon_md" />
				<span class="heavy">Flit Web</span>
			</a>
			<div class="nav__links nav__links--center">
				{#each centerNavItems as item (item.href)}
					<a href={resolve(item.href)} class="link {isActive(item.href) ? 'link--active' : ''}">
						{item.label}
					</a>
				{/each}
			</div>

			<div class="nav__links nav__links--end">
				{#if isLoggedIn}
					<span class="nav__auth-welcome">
						Welcome, <span>{$currentUser?.username}</span>
					</span>
					<button type="button" onclick={handleLogout} class="btn"> Sign out </button>
				{:else}
					<a href={resolve('/login')} class="btn"> Sign in </a>
					<a href={resolve('/register')} class="btn btn-primary">Sign up</a>
				{/if}
			</div>

			<button
				type="button"
				onclick={() => (showMobileMenu = !showMobileMenu)}
				class="nav__mobile-trigger"
				aria-expanded={showMobileMenu}
				aria-label="Main menu"
			>
				<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

			{#if showMobileMenu}
				<button
					type="button"
					class="nav__mobile-backdrop"
					aria-label="Close menu"
					onclick={closeMobileMenu}
				></button>
				<div class="nav__mobile">
					<div class="nav__mobile-nav-list">
						{#each centerNavItems as item (item.href)}
							<a
								href={resolve(item.href)}
								class="nav__mobile-link {isActive(item.href) ? 'nav__mobile-link--active' : ''}"
								onclick={closeMobileMenu}
							>
								{item.label}
							</a>
						{/each}
					</div>
					<div class="nav__mobile-user">
						{#if isLoggedIn}
							<div class="nav__mobile-user-inner">
								<div class="nav__mobile-user-avatar">
									{($currentUser?.email ?? '').charAt(0).toUpperCase()}
								</div>
								<div class="nav__mobile-user-email">{$currentUser?.email}</div>
							</div>
							<div class="nav__mobile-actions">
								<button type="button" onclick={handleLogout} class="nav__mobile-action"
									>Sign out</button
								>
							</div>
						{:else}
							<div class="nav__mobile-actions">
								<a href={resolve('/login')} class="nav__mobile-action">Sign in</a>
								<a href={resolve('/register')} class="nav__mobile-action nav__mobile-action--link"
									>Sign up</a
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</nav>

	<main class="main">
		{@render children()}
	</main>
	<ConfirmDialog />
	<footer>
		<div class="container">
			<div class="footer__links">
				<a href={resolve('/about')} class="link">About</a>
				<a href={resolve('/terms')} class="link">Terms</a>
			</div>
			<p>
				"But seek first the kingdom of God and His righteousness, and all these things shall be
				added to you." - Matthew 6:33
			</p>
			<p>
				&copy; 2026 Flit-PKM and all related apps are brought to you by
				<a href="https://bmd-studios.com" target="_blank" rel="noopener noreferrer">BMD-Studios</a>
			</p>
		</div>
	</footer>
</div>
