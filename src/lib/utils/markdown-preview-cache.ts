import { markdownToSafeHtml } from '$lib/utils/markdown';

const cache = new Map<string, string>();
const MAX_ENTRIES = 500;

function cacheKey(noteId: number, content: string): string {
	return `${noteId}:${content}`;
}

export function getCachedNotePreviewHtml(noteId: number, content: string): string {
	const key = cacheKey(noteId, content ?? '');
	const hit = cache.get(key);
	if (hit !== undefined) return hit;
	const html = markdownToSafeHtml(content ?? '', { maxLines: 5 });
	if (cache.size >= MAX_ENTRIES) {
		const first = cache.keys().next().value;
		if (first) cache.delete(first);
	}
	cache.set(key, html);
	return html;
}

export function clearMarkdownPreviewCache(): void {
	cache.clear();
}
