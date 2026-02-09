/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { markdownToSafeHtml } from './markdown';

describe('markdownToSafeHtml', () => {
	it('returns empty string for empty input', () => {
		expect(markdownToSafeHtml('')).toBe('');
		expect(markdownToSafeHtml('   ')).toBe('');
		expect(markdownToSafeHtml('\n\n')).toBe('');
	});

	it('returns empty string for null/undefined when used with ??', () => {
		expect(markdownToSafeHtml(null as unknown as string)).toBe('');
		// raw?.trim() ?? '' yields '' for undefined
		expect(markdownToSafeHtml(undefined as unknown as string)).toBe('');
	});

	it('renders basic markdown to safe HTML', () => {
		const html = markdownToSafeHtml('**bold** and *italic*');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<em>italic</em>');
	});

	it('renders headings', () => {
		const html = markdownToSafeHtml('# Heading 1');
		expect(html).toContain('<h1');
		expect(html).toContain('Heading 1');
	});

	it('renders lists', () => {
		const html = markdownToSafeHtml('- one\n- two');
		expect(html).toContain('<ul>');
		expect(html).toContain('<li>');
		expect(html).toContain('one');
		expect(html).toContain('two');
	});

	it('truncates to maxLines when option provided', () => {
		const raw = 'line one\nline two\nline three\nline four';
		const html = markdownToSafeHtml(raw, { maxLines: 2 });
		expect(html).toContain('line one');
		expect(html).toContain('line two');
		expect(html).not.toContain('line four');
	});

	it('ignores maxLines when 0 or negative', () => {
		const raw = 'a\nb\nc';
		expect(markdownToSafeHtml(raw, { maxLines: 0 })).toContain('c');
		expect(markdownToSafeHtml(raw)).toContain('c');
	});

	it('sanitizes script tags and dangerous HTML', () => {
		const dirty = '<script>alert(1)</script>hello';
		const html = markdownToSafeHtml(dirty);
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('alert');
		expect(html).toContain('hello');
	});

	it('sanitizes onclick and other event handlers', () => {
		const dirty = '<img src=x onerror="alert(1)">';
		const html = markdownToSafeHtml(dirty);
		expect(html).not.toContain('onerror');
	});
});
