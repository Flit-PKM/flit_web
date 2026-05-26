<script lang="ts">
	import type { NoteRead } from '$lib/types/note';

	let {
		note,
		isOpen = false,
		isPinning = false,
		isAppending = false,
		onTogglePin,
		onAppend,
		onDelete,
		onClose
	}: {
		note: NoteRead;
		isOpen?: boolean;
		isPinning?: boolean;
		isAppending?: boolean;
		onTogglePin: () => void;
		onAppend: () => void;
		onDelete: () => void;
		onClose: () => void;
	} = $props();

	let menuIndex = $state(0);

	function handleMenuKeydown(event: KeyboardEvent) {
		if (!isOpen) return;
		const items = 3;
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			menuIndex = (menuIndex + 1) % items;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			menuIndex = (menuIndex + items - 1) % items;
		}
	}

	$effect(() => {
		if (isOpen) menuIndex = 0;
	});
</script>

<svelte:window onkeydown={handleMenuKeydown} />

{#if isOpen}
	<div
		id={`note-options-${note.id}`}
		class="note-list__options-menu"
		role="menu"
		aria-label={`Actions for ${note.title}`}
	>
		<button
			type="button"
			class="note-list__menu-item"
			role="menuitem"
			tabindex={menuIndex === 0 ? 0 : -1}
			disabled={isPinning}
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onTogglePin();
			}}
		>
			{note.pinned ? 'Unpin' : 'Pin'}
		</button>
		<button
			type="button"
			class="note-list__menu-item"
			role="menuitem"
			tabindex={menuIndex === 1 ? 0 : -1}
			disabled={isAppending}
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onAppend();
			}}
		>
			Append
		</button>
		<button
			type="button"
			class="note-list__menu-item note-list__menu-item--danger"
			role="menuitem"
			tabindex={menuIndex === 2 ? 0 : -1}
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onDelete();
			}}
		>
			Delete
		</button>
	</div>
{/if}
