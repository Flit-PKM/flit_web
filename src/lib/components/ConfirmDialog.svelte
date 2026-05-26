<script lang="ts">
	import {
		confirmDialogMessage,
		confirmDialogOpen,
		resolveConfirmDialog
	} from '$lib/stores/confirmDialog';

	let open = $state(false);
	let message = $state('');

	$effect(() => {
		const unsubOpen = confirmDialogOpen.subscribe((v) => (open = v));
		const unsubMsg = confirmDialogMessage.subscribe((v) => (message = v));
		return () => {
			unsubOpen();
			unsubMsg();
		};
	});
</script>

{#if open}
	<div
		class="modal-backdrop modal-backdrop--overlay"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="confirm-dialog-title"
		onclick={(e) => e.target === e.currentTarget && resolveConfirmDialog(false)}
		onkeydown={(e) => e.key === 'Escape' && resolveConfirmDialog(false)}
		tabindex="-1"
	>
		<div class="card confirm-dialog" role="document">
			<h2 id="confirm-dialog-title" class="section-title--muted">Confirm</h2>
			<p>{message}</p>
			<div class="confirm-dialog__actions">
				<button type="button" class="btn btn-secondary" onclick={() => resolveConfirmDialog(false)}>
					Cancel
				</button>
				<button type="button" class="btn btn-danger" onclick={() => resolveConfirmDialog(true)}>
					Confirm
				</button>
			</div>
		</div>
	</div>
{/if}
