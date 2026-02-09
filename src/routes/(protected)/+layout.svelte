<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAuthenticated } from '$lib/stores/auth';

	let { children } = $props();

	// Redirect unauthenticated users to login (single place for all protected routes)
	$effect(() => {
		if (!$isAuthenticated) {
			goto(resolve('/login'));
		}
	});
</script>

{#if $isAuthenticated}
	{@render children()}
{/if}
