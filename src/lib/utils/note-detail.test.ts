import { describe, expect, it } from 'vitest';
import {
	formatRelationshipTypeLabel,
	normalizeNoteContent,
	normalizeNoteTitle
} from './note-detail';
import type { RelationshipRead } from '$lib/types/note';

const baseRelationship: Omit<RelationshipRead, 'note_a_id' | 'note_b_id'> = {
	type: 'FOLLOWS_ON',
	version: 1,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z',
	is_deleted: false
};

describe('note-detail utilities', () => {
	it('normalizes title and content for autosave comparisons', () => {
		expect(normalizeNoteTitle('  Hello  ')).toBe('Hello');
		expect(normalizeNoteContent('line1\r\nline2\n')).toBe('line1\nline2');
	});

	it('formats directional follows_on relationship labels', () => {
		expect(
			formatRelationshipTypeLabel({ ...baseRelationship, note_a_id: 1, note_b_id: 2 }, 1)
		).toBe('Follows from');
		expect(
			formatRelationshipTypeLabel({ ...baseRelationship, note_a_id: 1, note_b_id: 2 }, 2)
		).toBe('Follows to');
	});
});
