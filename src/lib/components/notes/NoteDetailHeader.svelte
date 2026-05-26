<script lang="ts">
	import type { NoteDetail } from '$lib/types/note';
	import { formatNoteDate } from '$lib/utils/note-detail';

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

	const statusLabel = $derived(
		saveStatus === 'saving'
			? 'Saving…'
			: saveStatus === 'saved'
				? 'Saved'
				: saveStatus === 'error'
					? 'Save failed'
					: ''
	);
</script>

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
			<button type="button" onclick={onAppend} disabled={isAppending || isSaving} class="btn">
				Append
			</button>
			<button type="button" onclick={onTogglePin} disabled={isSaving} class="btn">
				{note.pinned ? 'Unpin' : 'Pin'}
			</button>
			<button type="button" onclick={onDelete} disabled={isSaving} class="btn btn-danger">
				Delete
			</button>
		</div>
	</div>
	<div class="note-detail__meta">
		<span>Type: {note.type}</span>
		<span>Updated: {formatNoteDate(note.updated_at)}</span>
		<span>Created: {formatNoteDate(note.created_at)}</span>
	</div>
	{#if saveError}
		<p class="form-group__error note-detail__save-error">{saveError}</p>
	{/if}
</header>
