import { get } from 'svelte/store';
import { describe, expect, it, beforeEach } from 'vitest';
import {
	applyNoteListSyncPatch,
	clearNoteListSync,
	consumeNoteListSync,
	noteListSync,
	publishNoteListSync
} from './noteListSync';
import type { NoteRead } from '$lib/types/note';

const baseNote: NoteRead = {
	id: 1,
	user_id: 1,
	title: 'A',
	content: 'body',
	color: '',
	pinned: false,
	type: 'BASE',
	source_id: null,
	version: 1,
	updated_at: '2025-01-01T00:00:00Z',
	created_at: '2025-01-01T00:00:00Z',
	is_deleted: false
};

describe('noteListSync', () => {
	beforeEach(() => {
		clearNoteListSync();
	});

	it('applyNoteListSyncPatch merges fields for matching id', () => {
		const merged = applyNoteListSyncPatch([baseNote], {
			id: 1,
			title: 'A',
			content: 'body',
			color: '#ff0000',
			pinned: false,
			type: 'BASE',
			version: 2,
			updated_at: '2025-01-02T00:00:00Z'
		});
		expect(merged?.[0].color).toBe('#FF0000');
		expect(merged?.[0].version).toBe(2);
	});

	it('applyNoteListSyncPatch returns null when note id is not in list', () => {
		const merged = applyNoteListSyncPatch([baseNote], {
			id: 99,
			title: 'X',
			content: '',
			color: '#00ff00',
			pinned: false,
			type: 'BASE',
			version: 1,
			updated_at: '2025-01-02T00:00:00Z'
		});
		expect(merged).toBeNull();
	});

	it('consumeNoteListSync returns patch and clears store', () => {
		publishNoteListSync({
			id: 1,
			title: 'A',
			content: 'body',
			color: '#FDE68A',
			pinned: false,
			type: 'BASE',
			version: 2,
			updated_at: '2025-01-02T00:00:00Z'
		});
		const patch = consumeNoteListSync();
		expect(patch?.color).toBe('#FDE68A');
		expect(get(noteListSync)).toBeNull();
		expect(consumeNoteListSync()).toBeNull();
	});

	it('clearNoteListSync removes pending patch', () => {
		publishNoteListSync({
			id: 1,
			title: 'A',
			content: 'body',
			color: '',
			pinned: false,
			type: 'BASE',
			version: 1,
			updated_at: '2025-01-01T00:00:00Z'
		});
		clearNoteListSync();
		expect(get(noteListSync)).toBeNull();
	});
});
