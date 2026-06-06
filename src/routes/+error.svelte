<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';

	let status = $derived($page.status);
	let error = $derived($page.error);
	let isNotFound = $derived(status === 404);
	let title = $derived(isNotFound ? 'Page Not Found - Flit Web' : `Error ${status} - Flit Web`);
	let message = $derived(
		isNotFound
			? 'The page you requested could not be found.'
			: (error?.message ?? 'Something went wrong.')
	);
</script>

<SeoHead
	{title}
	description={isNotFound
		? 'The page you requested could not be found on Flit Web.'
		: 'An error occurred while loading this page.'}
	noindex
/>

<div class="card">
	<h1>{isNotFound ? 'Page not found' : `Error ${status}`}</h1>
	<p class="card__meta">{message}</p>
	<a href={resolve('/')} class="btn btn-primary mt-sm">Return home</a>
</div>
