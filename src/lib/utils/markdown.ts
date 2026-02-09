import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Escapes raw text for safe HTML display when markdown parsing fails.
 */
function escapeHtml(raw: string): string {
	return raw
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Converts markdown to sanitized HTML. Safe to use with {@html} in Svelte.
 * Optionally truncates to the first maxLines lines before parsing.
 *
 * @param raw - Raw markdown string
 * @param options - Optional { maxLines } to limit preview length
 * @returns Sanitized HTML string, or escaped plain text on parse error
 */
export function markdownToSafeHtml(
	raw: string,
	options?: { maxLines?: number }
): string {
	const trimmed = raw?.trim() ?? '';
	if (!trimmed) return '';

	let snippet = trimmed;
	if (options?.maxLines != null && options.maxLines > 0) {
		snippet = trimmed.split('\n').slice(0, options.maxLines).join('\n');
	}

	try {
		const parsed = marked.parse(snippet, { async: false }) as string;
		return DOMPurify.sanitize(parsed);
	} catch {
		return escapeHtml(snippet);
	}
}
