import { browser } from '$app/environment';
import type { ApiClient } from '$lib/api/client';
import {
	APPEND_RELATIONSHIP_TYPE,
	DEFAULT_NEW_NOTE_CONTENT,
	DEFAULT_NEW_NOTE_TITLE
} from '$lib/constants/notes';
import { normalizeNoteContent, normalizeNoteTitle } from '$lib/utils/note-detail';
import type { NoteRead } from '$lib/types/note';

const DRAFT_NOTE_IDS_KEY = 'flit-draft-note-ids';

export function defaultNewNotePayload() {
	return { title: DEFAULT_NEW_NOTE_TITLE, content: DEFAULT_NEW_NOTE_CONTENT };
}

export function isDefaultNewNote(title: string, content: string): boolean {
	return (
		normalizeNoteTitle(title) === normalizeNoteTitle(DEFAULT_NEW_NOTE_TITLE) &&
		normalizeNoteContent(content) === normalizeNoteContent(DEFAULT_NEW_NOTE_CONTENT)
	);
}

function readDraftIds(): number[] {
	if (!browser) return [];
	try {
		const raw = sessionStorage.getItem(DRAFT_NOTE_IDS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is number => typeof id === 'number' && Number.isInteger(id));
	} catch {
		return [];
	}
}

function writeDraftIds(ids: number[]): void {
	if (!browser) return;
	if (ids.length === 0) {
		sessionStorage.removeItem(DRAFT_NOTE_IDS_KEY);
	} else {
		sessionStorage.setItem(DRAFT_NOTE_IDS_KEY, JSON.stringify(ids));
	}
}

/** Mark a note as an untouched draft (eligible for orphan cleanup on leave). */
export function markNoteAsDraft(noteId: number): void {
	if (!browser) return;
	const ids = readDraftIds();
	if (!ids.includes(noteId)) {
		writeDraftIds([...ids, noteId]);
	}
}

export function clearDraftNote(noteId: number): void {
	if (!browser) return;
	writeDraftIds(readDraftIds().filter((id) => id !== noteId));
}

export function isDraftNote(noteId: number): boolean {
	return readDraftIds().includes(noteId);
}

export type CreateNoteNavigateResult =
	| { success: true; note: NoteRead }
	| { success: false; error: string; createdNoteId?: number };

/**
 * Creates a note with default title/content, marks it as draft, and navigates to the editor.
 */
export async function createNoteAndNavigate(params: {
	apiClient: ApiClient;
	goto: (url: string) => Promise<void>;
	/** Typed route resolver from `$app/paths` (accepts dynamic note paths). */
	resolve: (path: `/${string}`) => string;
	appendFromNoteId?: number;
}): Promise<CreateNoteNavigateResult> {
	const { apiClient, goto, resolve, appendFromNoteId } = params;
	let created: NoteRead;
	try {
		created = await apiClient.createNote(defaultNewNotePayload());
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to create note.';
		return { success: false, error: message };
	}

	markNoteAsDraft(created.id);
	const path = (
		appendFromNoteId != null
			? `/notes/${created.id}?edit=1&append=${appendFromNoteId}`
			: `/notes/${created.id}?edit=1`
	) as `/${string}`;
	try {
		await goto(resolve(path));
		return { success: true, note: created };
	} catch (err) {
		const message =
			err instanceof Error
				? err.message
				: 'Note created but navigation failed. Open or delete the draft.';
		return { success: false, error: message, createdNoteId: created.id };
	}
}

/**
 * Deletes a draft note that was never edited, if it is still marked as draft with default content.
 */
export async function cleanupDraftNoteIfUnused(
	apiClient: ApiClient,
	noteId: number,
	title: string,
	content: string
): Promise<void> {
	if (!isDraftNote(noteId)) return;
	if (!isDefaultNewNote(title, content)) {
		clearDraftNote(noteId);
		return;
	}
	try {
		await apiClient.deleteNote(noteId);
	} catch {
		// Best effort; leave draft marker so a later visit can retry cleanup.
		return;
	}
	clearDraftNote(noteId);
}

export { APPEND_RELATIONSHIP_TYPE };
