<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { getProtectedRouteRedirect } from '$lib/utils/navigation';
	import { NOINDEX_ROBOTS } from '$lib/utils/seo';

	let { children } = $props();

	// Redirect unauthenticated users to login (single place for all protected routes)
	$effect(() => {
		const redirectPath = getProtectedRouteRedirect($isAuthenticated);
		if (redirectPath) goto(redirectPath as Parameters<typeof goto>[0]);
	});
</script>

<svelte:head>
	<meta name="robots" content={NOINDEX_ROBOTS} />
</svelte:head>

{#if $isAuthenticated}
	{@render children()}
{/if}
