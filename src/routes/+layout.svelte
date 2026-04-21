<script lang="ts">
	import '../css/style.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve, asset } from '$app/paths';
	import { page } from '$app/stores';
	import { authActions, currentUser, isAuthenticated } from '$lib/stores/auth';
	import { pendingColorScheme } from '$lib/stores/theme';

	let { children } = $props();
	let showMobileMenu = $state(false);

	let isLoggedIn = $derived($isAuthenticated && $currentUser);

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

	// Navigation items - only show when authenticated
	type NavHref = '/notes' | '/profile';
	const navItems: { href: NavHref; label: string }[] = [
		{ href: '/notes', label: 'Notes' },
		{ href: '/profile', label: 'Profile' }
	];
	let visibleNavItems = $derived($isAuthenticated ? navItems : []);

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
		return false;
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={asset('/images/flit_app_logo.svg')} />
	<title>Flit Web</title>
	<meta
		name="description"
		content="Flit - Note Taking & Personal Knowledge Management. Create, Edit and Delete notes, build Relationships and Categorize them for easy navigation and summarization. Part of the Flit-PKM ecosystem."
	/>
</svelte:head>

<div class="app">
	<nav>
		<div class="nav__container">
			<a href={resolve('/')} class="nav__links nav__brand">
				<img src={asset('/images/flit_app_logo.svg')} alt="Flit" class="icon_md" />
				<span class="heavy">Flit Web</span>
			</a>
			<div class="nav__links">
				{#each visibleNavItems as item (item.href)}
					<a href={resolve(item.href)} class="link {isActive(item.href) ? 'link--active' : ''}">
						{item.label}
					</a>
				{/each}
			</div>

			<div class="nav__links">
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
				<div class="nav__mobile">
					{#if $isAuthenticated}
						<div class="nav__mobile-nav-list">
							{#each visibleNavItems as item (item.href)}
								<a
									href={resolve(item.href)}
									class="nav__mobile-link {isActive(item.href) ? 'nav__mobile-link--active' : ''}"
								>
									{item.label}
								</a>
							{/each}
						</div>
					{/if}
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
