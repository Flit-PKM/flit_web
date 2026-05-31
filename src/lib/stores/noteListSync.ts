import { writable } from 'svelte/store';
import type { NoteRead } from '$lib/types/note';
import { normalizeNoteRead } from '$lib/utils/notes';

/** Fields synced from note detail back to the notes list. */
export type NoteListSyncPatch = Pick<
	NoteRead,
	'id' | 'title' | 'content' | 'color' | 'pinned' | 'type' | 'version' | 'updated_at'
>;

export const noteListSync = writable<NoteListSyncPatch | null>(null);

export function publishNoteListSync(patch: NoteListSyncPatch): void {
	noteListSync.set(patch);
}

export function applyNoteListSyncPatch(
	notes: NoteRead[],
	patch: NoteListSyncPatch
): NoteRead[] | null {
	if (!notes.some((n) => n.id === patch.id)) return null;
	return notes.map((n) => (n.id === patch.id ? normalizeNoteRead({ ...n, ...patch }) : n));
}
