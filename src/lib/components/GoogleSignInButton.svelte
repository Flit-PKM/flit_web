<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { authActions } from '$lib/stores/auth';

	let {
		disabled = false,
		onSuccess,
		onError
	}: {
		disabled?: boolean;
		onSuccess: () => void;
		onError: (message: string) => void;
	} = $props();

	const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();

	let hostEl = $state<HTMLDivElement | null>(null);
	let busy = $state(false);

	const latestDisabled = $derived(disabled);

	function waitForGoogle(maxMs = 15000, isCancelled: () => boolean): Promise<GoogleAccountsId> {
		return new Promise((resolve, reject) => {
			const start = Date.now();
			function tickLoop() {
				if (isCancelled()) {
					reject(new Error('cancelled'));
					return;
				}
				const id = window.google?.accounts?.id;
				if (id) {
					resolve(id);
					return;
				}
				if (Date.now() - start > maxMs) {
					reject(new Error('Google Sign-In timed out'));
					return;
				}
				requestAnimationFrame(tickLoop);
			}
			tickLoop();
		});
	}

	onMount(() => {
		if (!browser || !clientId) return;

		let cancelled = false;
		const isCancelled = () => cancelled;

		(async () => {
			await tick();
			if (cancelled || !hostEl) return;

			try {
				const id = await waitForGoogle(15000, isCancelled);
				if (cancelled || !hostEl) return;

				id.initialize({
					client_id: clientId,
					callback: async (response) => {
						if (latestDisabled || busy || !response?.credential) return;
						busy = true;
						try {
							const result = await authActions.loginWithGoogle(response.credential);
							if (result.success) {
								onSuccess();
							} else {
								onError(result.error ?? 'Google sign-in failed.');
							}
						} finally {
							busy = false;
						}
					}
				});

				const widthPx = Math.max(Math.round(hostEl.offsetWidth || 0), 200);
				id.renderButton(hostEl, {
					type: 'standard',
					theme: 'outline',
					size: 'large',
					text: 'continue_with',
					shape: 'pill',
					logo_alignment: 'left',
					width: widthPx
				});
			} catch (e) {
				if (cancelled) return;
				const message = e instanceof Error ? e.message : 'Google Sign-In unavailable.';
				if (message !== 'cancelled') {
					onError(message);
				}
			}
		})();

		return () => {
			cancelled = true;
			window.google?.accounts?.id?.cancel();
		};
	});
</script>

<svelte:head>
	{#if clientId}
		<script src="https://accounts.google.com/gsi/client" async defer></script>
	{/if}
</svelte:head>

{#if clientId}
	<div class="auth__google-stack">
		<div bind:this={hostEl} class="auth__google-host"></div>
	</div>
{/if}
