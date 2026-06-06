<script lang="ts">
	import { escapeJsonLd } from '$lib/utils/seo';

	interface Props {
		data: Record<string, unknown>;
	}

	let { data }: Props = $props();

	let jsonLdString = $derived(escapeJsonLd(data));
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags, @typescript-eslint/no-unused-expressions -->
	{@html '<script type="application/ld+json">' + jsonLdString + '</script>'}
</svelte:head>
