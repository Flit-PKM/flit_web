/**
 * Note types matching the backend OpenAPI schemas.
 * NoteDetail is the expanded response from GET /notes/{note_id} (includes relationships and categories).
 */

export type NoteType = 'BASE' | 'INSIGHT' | 'SUMMARY';

export interface NoteRead {
	id: number;
	user_id: number;
	title: string;
	content: string;
	type: NoteType;
	source_id: number | null;
	version: number;
	is_deleted: boolean;
	created_at: string;
	updated_at: string;
}

export type RelationshipType =
	| 'FOLLOWS_ON'
	| 'SIMILAR_TO'
	| 'CONTRADICTS'
	| 'REFERENCES'
	| 'RELATED_TO';

export interface RelationshipRead {
	note_a_id: number;
	note_b_id: number;
	type: RelationshipType;
	version: number;
	created_at: string;
	updated_at: string;
	is_deleted: boolean;
}

export interface CategoryRead {
	id: number;
	user_id: number;
	name: string;
	version: number;
	created_at: string;
	updated_at: string;
	is_deleted: boolean;
}

/** Request body for PUT /notes/{note_id}. */
export interface NoteUpdate {
	title?: string | null;
	content?: string | null;
	type?: NoteType | null;
}

/** Request body for POST /notes. */
export interface NoteCreate {
	title: string;
	content: string;
	type?: NoteType;
}

/** Request body for POST /categories. */
export interface CategoryCreate {
	name: string;
}

/** Request body for POST /relationships. */
export interface RelationshipCreate {
	note_a_id: number;
	note_b_id: number;
	type: RelationshipType;
}

/** Request body for POST /note-categories (add category to note). */
export interface NoteCategoryCreate {
	note_id: number;
	category_id: number;
}

/** Expanded note response from GET /notes/{note_id} (includes relationships and categories). */
export interface NoteDetail extends NoteRead {
	relationships?: RelationshipRead[];
	categories?: CategoryRead[];
}
