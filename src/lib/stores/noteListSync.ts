import { get, writable } from 'svelte/store';
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

/** Returns the pending patch and clears the store (one-shot consume). */
export function consumeNoteListSync(): NoteListSyncPatch | null {
	const patch = get(noteListSync);
	noteListSync.set(null);
	return patch;
}

export function clearNoteListSync(): void {
	noteListSync.set(null);
}

export function applyNoteListSyncPatch(
	notes: NoteRead[],
	patch: NoteListSyncPatch
): NoteRead[] | null {
	if (!notes.some((n) => n.id === patch.id)) return null;
	return notes.map((n) => (n.id === patch.id ? normalizeNoteRead({ ...n, ...patch }) : n));
}
