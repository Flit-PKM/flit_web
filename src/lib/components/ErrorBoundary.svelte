<script lang="ts">
	import { onMount } from 'svelte';
	import { errorLogger } from '$lib/utils/error-handler';

	// This component catches unhandled errors in the application
	let hasError = false;
	let error: Error | null = null;
	let errorInfo: string | null = null;

	function toError(value: unknown): Error {
		return value instanceof Error ? value : new Error(String(value));
	}

	// Set up global error handling
	onMount(() => {
		const handleError = (event: ErrorEvent) => {
			const err = toError(event.error);
			errorLogger.logError(err, {
				component: 'GlobalErrorBoundary',
				operation: 'uncaughtError',
				url: window.location.href
			});

			hasError = true;
			error = err;
			errorInfo = err.stack ?? 'No stack trace available';
		};

		const handlePromiseRejection = (event: PromiseRejectionEvent) => {
			const err = toError(event.reason);
			errorLogger.logError(err, {
				component: 'GlobalErrorBoundary',
				operation: 'unhandledRejection',
				url: window.location.href
			});

			hasError = true;
			error = err;
			errorInfo = err.stack ?? 'No stack trace available';
		};

		window.addEventListener('error', handleError);
		window.addEventListener('unhandledrejection', handlePromiseRejection);

		return () => {
			window.removeEventListener('error', handleError);
			window.removeEventListener('unhandledrejection', handlePromiseRejection);
		};
	});
</script>

{#if hasError}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-red-50 p-4">
		<div class="max-w-md rounded-lg bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-red-800">An error occurred</h2>
			<p class="mt-2 text-red-700">
				We're sorry, but something went wrong. Please try refreshing the page.
			</p>
			<div class="mt-4 text-sm text-red-600">
				<p>Error: {error?.message || 'Unknown error'}</p>
				{#if errorInfo}
					<pre class="mt-2 overflow-auto text-xs">{errorInfo}</pre>
				{/if}
			</div>
			<div class="mt-4 flex justify-end">
				<button
					onclick={() => window.location.reload()}
					class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				>
					Refresh Page
				</button>
			</div>
		</div>
	</div>
{/if}

<slot />
