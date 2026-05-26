<script lang="ts">
	import { resolve } from '$app/paths';
	import type { NoteRead } from '$lib/types/note';
	import NoteOptionsMenu from './NoteOptionsMenu.svelte';

	let {
		note,
		previewHtml = '',
		showPreview = false,
		isOptionsOpen = false,
		isPinning = false,
		isAppending = false,
		onToggleOptions,
		onTogglePin,
		onAppend,
		onDelete,
		onCloseOptions
	}: {
		note: NoteRead;
		previewHtml?: string;
		showPreview?: boolean;
		isOptionsOpen?: boolean;
		isPinning?: boolean;
		isAppending?: boolean;
		onToggleOptions: (event: MouseEvent) => void;
		onTogglePin: () => void;
		onAppend: () => void;
		onDelete: () => void;
		onCloseOptions: () => void;
	} = $props();
</script>

<div class="card note-list__card">
	<div class="note-list__accent" aria-hidden="true"></div>
	<a href={resolve(`/notes/${note.id}`)} class="note-list__main-link">
		<h2 class="note-list__title">{note.title}</h2>
		<hr class="note-list__divider" />
		{#if showPreview}
			<div class="prose">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized via markdownToSafeHtml -->
				{@html previewHtml}
			</div>
		{/if}
	</a>
	<div class="note-list__options">
		<button
			type="button"
			class="btn note-list__options-trigger"
			title="Note options"
			aria-haspopup="menu"
			aria-expanded={isOptionsOpen}
			aria-controls={`note-options-${note.id}`}
			onclick={onToggleOptions}
		>
			<span class="visually-hidden">Open options for {note.title}</span>
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
			isOpen={isOptionsOpen}
			{isPinning}
			{isAppending}
			{onTogglePin}
			{onAppend}
			{onDelete}
			onClose={onCloseOptions}
		/>
	</div>
</div>
