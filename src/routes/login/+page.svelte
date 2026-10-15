<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/auth';
	import { resolvePostLoginDestination } from '$lib/utils/navigation';
	import AuthCredentialsForm from '$lib/components/AuthCredentialsForm.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';

	let isRegister = $derived($page.url.searchParams.get('mode') === 'register');

	$effect(() => {
		if ($isAuthenticated) {
			const requested = $page.url.searchParams.get('redirect');
			const path = resolvePostLoginDestination(requested);
			goto(path as Parameters<typeof goto>[0]);
		}
	});
</script>

<SeoHead
	title={isRegister ? 'Create account - Flit Web' : 'Sign In - Flit Web'}
	description="Sign in or create a Flit Web account to access your notes."
	noindex
/>

<div class="auth">
	<div class="auth__inner">
		<div class="auth__header">
			{#if isRegister}
				<h1>Create your account</h1>
				<p>Sign up and start taking notes.</p>
			{:else}
				<h1>Welcome back</h1>
				<p>Sign in to continue</p>
			{/if}
		</div>
		<div class="card">
			{#if $page.url.searchParams.get('password_reset') === 'success'}
				<div class="alert alert--success" role="status">
					<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<p class="alert__message">Password updated. Please sign in.</p>
				</div>
			{/if}
			<AuthCredentialsForm autofocusEmail />
		</div>
	</div>
</div>
