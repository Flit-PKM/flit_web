<script lang="ts">
	import type { NoteDetail } from '$lib/types/note';
	import { formatNoteDate } from '$lib/utils/note-detail';
	import NoteOptionsMenu from './NoteOptionsMenu.svelte';

	let {
		note,
		liveTitle = '',
		isSaving = false,
		isAppending = false,
		saveError = '',
		saveStatus = 'idle' as 'idle' | 'saving' | 'saved' | 'error',
		onTitleChange,
		onAppend,
		onTogglePin,
		onDelete
	}: {
		note: NoteDetail;
		liveTitle?: string;
		isSaving?: boolean;
		isAppending?: boolean;
		saveError?: string;
		saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
		onTitleChange: (value: string) => void;
		onAppend: () => void;
		onTogglePin: () => void;
		onDelete: () => void;
	} = $props();

	let optionsOpen = $state(false);

	const statusLabel = $derived(
		saveStatus === 'saving'
			? 'Saving…'
			: saveStatus === 'saved'
				? 'Saved'
				: saveStatus === 'error'
					? 'Save failed'
					: ''
	);

	function toggleOptions(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		optionsOpen = !optionsOpen;
	}

	function closeOptions() {
		optionsOpen = false;
	}
</script>

<svelte:window
	onclick={() => {
		if (optionsOpen) closeOptions();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && optionsOpen) closeOptions();
	}}
/>

<header class="note-detail__header">
	<div class="note-detail__header-row">
		<div class="note-detail__header-title-wrap">
			<input
				type="text"
				value={liveTitle}
				oninput={(e) => onTitleChange(e.currentTarget.value)}
				class="note-detail__title-input"
				placeholder="Title"
				autocomplete="off"
			/>
		</div>
		<div class="note-detail__actions">
			{#if statusLabel}
				<span class="note-save-status" role="status" aria-live="polite">{statusLabel}</span>
			{/if}
			<div class="note-list__options note-list__options--anchor">
				<button
					type="button"
					class="btn note-list__options-trigger"
					title="Note options"
					aria-haspopup="menu"
					aria-expanded={optionsOpen}
					aria-controls={`note-options-${note.id}`}
					onclick={toggleOptions}
				>
					<span class="visually-hidden">Open options for {liveTitle || note.title}</span>
					<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
						/>
					</svg>
				</button>
				<NoteOptionsMenu
					{note}
					isOpen={optionsOpen}
					isPinning={isSaving}
					{isAppending}
					onTogglePin={() => {
						onTogglePin();
						closeOptions();
					}}
					onAppend={() => {
						onAppend();
						closeOptions();
					}}
					onDelete={() => {
						onDelete();
						closeOptions();
					}}
					onClose={closeOptions}
				/>
			</div>
		</div>
	</div>
	<p class="note-detail__meta">Updated {formatNoteDate(note.updated_at)}</p>
	{#if saveError}
		<p class="form-group__error note-detail__save-error">{saveError}</p>
	{/if}
</header>
