import { SvelteMap } from 'svelte/reactivity';
import type { NoteDetail, RelationshipRead } from '$lib/types/note';
import type { ApiClient } from '$lib/api/client';
import { filterNotDeleted } from '$lib/utils/filter';

export function getOtherNoteId(rel: RelationshipRead, currentId: number): number {
	return rel.note_a_id === currentId ? rel.note_b_id : rel.note_a_id;
}

const TITLE_CACHE_TTL_MS = 60_000;
const noteTitleCache = new Map<number, { title: string; cachedAt: number }>();

function getCachedTitle(noteId: number): string | null {
	const entry = noteTitleCache.get(noteId);
	if (!entry) return null;
	if (Date.now() - entry.cachedAt > TITLE_CACHE_TTL_MS) {
		noteTitleCache.delete(noteId);
		return null;
	}
	return entry.title;
}

function primeTitleCache(notes: { id: number; title: string }[]): void {
	const now = Date.now();
	for (const note of notes) {
		noteTitleCache.set(note.id, { title: note.title, cachedAt: now });
	}
}

async function fetchMissingTitles(
	api: ApiClient,
	missingIds: number[]
): Promise<Array<{ id: number; title: string }>> {
	const responses = await Promise.allSettled(missingIds.map((id) => api.getNote(id)));
	const fetched: Array<{ id: number; title: string }> = [];
	for (const response of responses) {
		if (response.status !== 'fulfilled') continue;
		fetched.push({ id: response.value.id, title: response.value.title });
	}
	return fetched;
}

export async function buildRelatedTitleMap(
	api: ApiClient,
	noteData: NoteDetail
): Promise<SvelteMap<number, string>> {
	const relatedTitles = new SvelteMap<number, string>();
	const rels = filterNotDeleted(noteData.relationships);
	if (rels.length === 0) return relatedTitles;

	const otherIds = [...new Set(rels.map((r) => getOtherNoteId(r, noteData.id)))];
	if (otherIds.length === 0) return relatedTitles;

	const missingIds: number[] = [];
	for (const id of otherIds) {
		const cached = getCachedTitle(id);
		if (cached) {
			relatedTitles.set(id, cached);
		} else {
			missingIds.push(id);
		}
	}

	if (missingIds.length === 0) return relatedTitles;

	const fetchedTitles = await fetchMissingTitles(api, missingIds);
	primeTitleCache(fetchedTitles);

	for (const id of otherIds) {
		const title = getCachedTitle(id);
		if (title) relatedTitles.set(id, title);
	}

	return relatedTitles;
}
