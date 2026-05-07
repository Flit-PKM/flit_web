import type { RelationshipRead, RelationshipType } from '$lib/types/note';

export const RELATIONSHIP_TYPES: RelationshipType[] = [
	'RELATED_TO',
	'FOLLOWS_ON',
	'SIMILAR_TO',
	'CONTRADICTS',
	'REFERENCES'
];

export function normalizeNoteTitle(value: string): string {
	return value.trim();
}

export function normalizeNoteContent(value: string): string {
	return value.replace(/\r\n/g, '\n').trim();
}

export function formatRelationshipType(type: string): string {
	return type
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatRelationshipTypeLabel(rel: RelationshipRead, currentNoteId: number): string {
	if (rel.type === 'FOLLOWS_ON') {
		return currentNoteId === rel.note_a_id ? 'Follows from' : 'Follows to';
	}
	return formatRelationshipType(rel.type);
}

export function formatNoteDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}
