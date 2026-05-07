<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Markdown } from '@tiptap/markdown';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
	import { TaskList } from '@tiptap/extension-task-list';
	import { TaskItem } from '@tiptap/extension-task-item';

	type EditorMode = 'rich' | 'source';

	function buildExtensions() {
		return [
			StarterKit.configure({
				link: {
					openOnClick: false,
					autolink: true,
					linkOnPaste: true
				}
			}),
			Table.configure({ resizable: false }),
			TableRow,
			TableHeader,
			TableCell,
			TaskList,
			TaskItem.configure({ nested: true }),
			Markdown.configure({
				markedOptions: { gfm: true }
			}),
			Placeholder.configure({
				placeholder: 'Write markdown…'
			})
		];
	}

	let {
		noteId,
		initialContent,
		onChange
	}: {
		noteId: number;
		initialContent: string;
		onChange: (value: string) => void;
	} = $props();

	let tiptapHost = $state<HTMLDivElement | null>(null);
	let sourceHost = $state<HTMLTextAreaElement | null>(null);
	let editor = $state<Editor | null>(null);
	let mode = $state<EditorMode>('rich');
	// Intentional snapshot: parent remounts via `{#key note.id}` per note; textarea seed matches first load.
	// svelte-ignore state_referenced_locally
	let sourceText = $state(initialContent);
	// svelte-ignore state_referenced_locally
	let lastEmittedMarkdown = $state(initialContent);
	let editorMounted = $state(false);

	function normalizeForCompare(value: string): string {
		return value.replace(/\r\n/g, '\n').trim();
	}

	function emitFromRich() {
		const ed = editor;
		if (!ed || ed.isDestroyed || mode !== 'rich') return;
		const nextMarkdown = ed.getMarkdown();
		lastEmittedMarkdown = nextMarkdown;
		onChange(nextMarkdown);
	}

	function onSourceInput() {
		autosizeSource();
		onChange(sourceText);
	}

	function toggleMode() {
		setMode(mode === 'rich' ? 'source' : 'rich');
	}

	function setMode(next: EditorMode) {
		const ed = editor;
		if (next === 'source' && mode === 'rich') {
			if (ed && !ed.isDestroyed) {
				const nextSource = ed.getMarkdown();
				sourceText = nextSource;
				if (normalizeForCompare(nextSource) !== normalizeForCompare(lastEmittedMarkdown)) {
					lastEmittedMarkdown = nextSource;
					onChange(nextSource);
				}
			}
			mode = 'source';
			queueMicrotask(autosizeSource);
			return;
		}

		if (next === 'rich' && mode === 'source') {
			if (!ed || ed.isDestroyed) {
				mode = 'rich';
				return;
			}
			mode = 'rich';
			const nextSource = sourceText;
			ed.commands.setContent(nextSource, { contentType: 'markdown' });
			const nextMarkdown = ed.getMarkdown();
			if (normalizeForCompare(nextMarkdown) !== normalizeForCompare(lastEmittedMarkdown)) {
				lastEmittedMarkdown = nextMarkdown;
				onChange(nextMarkdown);
			}
			return;
		}

		mode = next;
	}

	function autosizeSource() {
		const el = sourceHost;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.max(el.scrollHeight, 384)}px`;
	}

	onMount(async () => {
		await tick();
		if (!tiptapHost) return;
		const ed = new Editor({
			element: tiptapHost,
			extensions: buildExtensions(),
			content: initialContent,
			contentType: 'markdown',
			editorProps: {
				attributes: {
					class: 'tiptap note-detail-editor__prose',
					spellcheck: 'true'
				}
			}
		});
		ed.on('update', () => {
			if (mode === 'rich') emitFromRich();
		});
		editor = ed;
		editorMounted = true;
		autosizeSource();
	});

	onDestroy(() => {
		editor?.destroy();
		editor = null;
	});
</script>

<div class="note-detail-editor" data-note-id={noteId}>
	<div class="note-detail-editor__panes">
		<div class="note-detail-editor__toolbar">
			<button
				type="button"
				class="btn btn-secondary btn--compact note-detail-editor__mode-toggle"
				disabled={!editorMounted}
				aria-pressed={mode === 'source'}
				aria-label={mode === 'rich' ? 'Switch to markdown source' : 'Switch to visual mode'}
				title={mode === 'rich' ? 'Switch to markdown source' : 'Switch to visual mode'}
				onclick={toggleMode}
			>
				{#if mode === 'rich'}
					<svg class="icon_sm" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M1 12C2.73 7.61 6.99 4.5 12 4.5c5.01 0 9.27 3.11 11 7.5-1.73 4.39-5.99 7.5-11 7.5C6.99 19.5 2.73 16.39 1 12Z"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6" />
					</svg>
				{:else}
					<svg class="icon_sm" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M1 12C2.73 7.61 6.99 4.5 12 4.5c1.74 0 3.38.37 4.86 1.03M19.5 8.5c1.48 1.01 2.67 2.31 3.5 3.5-1.73 4.39-5.99 7.5-11 7.5-1.74 0-3.38-.37-4.86-1.03M4.5 15.5C3.02 14.49 1.83 13.19 1 12"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M9.88 9.88A3 3 0 0 1 14.12 14.12M3 3l18 18"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
			</button>
		</div>

		<div class="note-detail-editor__rich" class:note-detail-editor__pane--hidden={mode !== 'rich'}>
			<div bind:this={tiptapHost} class="note-detail-editor__host"></div>
		</div>
		<textarea
			bind:this={sourceHost}
			bind:value={sourceText}
			class="note-detail-editor__source note-detail-editor__prose"
			rows={16}
			spellcheck="true"
			aria-label="Markdown source"
			class:note-detail-editor__pane--hidden={mode !== 'source'}
			oninput={onSourceInput}
		></textarea>
	</div>
</div>
