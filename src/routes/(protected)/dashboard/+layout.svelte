<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAuthenticated, currentUser } from '$lib/stores/auth';

	let { children } = $props();

	// Redirect non-superusers to profile (dashboard is superuser-only)
	$effect(() => {
		if ($isAuthenticated && !$currentUser?.is_superuser) {
			goto(resolve('/profile'));
		}
	});
</script>

{#if $isAuthenticated && $currentUser?.is_superuser}
	{@render children()}
{/if}
