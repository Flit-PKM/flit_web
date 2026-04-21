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
	<div class="modal-backdrop modal-backdrop--panel">
		<div class="card modal-dialog">
			<h2 class="section-title">An error occurred</h2>
			<p class="form-group__error">
				We're sorry, but something went wrong. Please try refreshing the page.
			</p>
			<div class="card__block">
				<p class="card__meta">Error: {error?.message || 'Unknown error'}</p>
				{#if errorInfo}
					<pre class="overflow-auto text-xs">{errorInfo}</pre>
				{/if}
			</div>
			<div class="card__row card__row--end">
				<button type="button" onclick={() => window.location.reload()} class="btn btn-danger">
					Refresh Page
				</button>
			</div>
		</div>
	</div>
{/if}

<slot />
