<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';

	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('mode', 'register');
		void goto(`${resolve('/login')}?${params.toString()}` as Parameters<typeof goto>[0], {
			replaceState: true
		});
	});
</script>
