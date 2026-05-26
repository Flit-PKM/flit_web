import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	isDefaultNewNote,
	markNoteAsDraft,
	clearDraftNote,
	isDraftNote,
	defaultNewNotePayload
} from './note-create';
import { DEFAULT_NEW_NOTE_TITLE, DEFAULT_NEW_NOTE_CONTENT } from '$lib/constants/notes';

vi.mock('$app/environment', () => ({ browser: true }));

describe('note-create', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('defaultNewNotePayload uses constants', () => {
		expect(defaultNewNotePayload()).toEqual({
			title: DEFAULT_NEW_NOTE_TITLE,
			content: DEFAULT_NEW_NOTE_CONTENT
		});
	});

	it('isDefaultNewNote detects unchanged defaults', () => {
		expect(isDefaultNewNote(DEFAULT_NEW_NOTE_TITLE, DEFAULT_NEW_NOTE_CONTENT)).toBe(true);
		expect(isDefaultNewNote('My title', DEFAULT_NEW_NOTE_CONTENT)).toBe(false);
	});

	it('tracks draft ids in sessionStorage', () => {
		markNoteAsDraft(42);
		expect(isDraftNote(42)).toBe(true);
		clearDraftNote(42);
		expect(isDraftNote(42)).toBe(false);
	});
});
