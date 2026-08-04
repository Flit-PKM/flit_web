<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient, HttpError } from '$lib/api/client';
	import { errorLogger, captureApiError } from '$lib/utils/error-handler';
	import { debounceTrailing } from '$lib/utils/debounce';
	import { filterNotDeleted } from '$lib/utils/filter';
	import { APPEND_RELATIONSHIP_TYPE } from '$lib/constants/notes';
	import {
		cleanupDraftNoteIfUnused,
		clearDraftNote,
		createNoteAndNavigate,
		isDefaultNewNote
	} from '$lib/utils/note-create';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import NoteCategoriesPanel from '$lib/components/notes/NoteCategoriesPanel.svelte';
	import NoteDetailHeader from '$lib/components/notes/NoteDetailHeader.svelte';
	import NoteRelationshipsPanel from '$lib/components/notes/NoteRelationshipsPanel.svelte';
	import NoteColorSlider from '$lib/components/notes/NoteColorSlider.svelte';
	import NoteSearchPopup from '$lib/components/notes/NoteSearchPopup.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { confirmAction } from '$lib/stores/confirmDialog';
	import { buildRelatedTitleMap } from '$lib/utils/notes';
	import { normalizeNoteRead } from '$lib/utils/notes';
	import { normalizeNoteContent, normalizeNoteTitle } from '$lib/utils/note-detail';
	import { normalizeNoteColor, noteColorInlineStyle } from '$lib/utils/note-color';
	import { publishNoteListSync } from '$lib/stores/noteListSync';
	import type {
		NoteDetail,
		NoteRead,
		NoteUpdate,
		RelationshipRead,
		CategoryRead,
		RelationshipType
	} from '$lib/types/note';
	import type { Component } from 'svelte';

	type NoteMarkdownEditorProps = {
		noteId: number;
		initialContent: string;
		onChange: (value: string) => void;
	};

	/** Client-only chunk: avoid static import so ProseMirror/Tiptap are not evaluated during SSR. */
	let NoteBodyEditor = $state<Component<NoteMarkdownEditorProps> | null>(null);

	if (browser) {
		void import('$lib/components/NoteMarkdownEditor.svelte').then((m) => {
			NoteBodyEditor = m.default;
		});
	}

	const AUTOSAVE_DEBOUNCE_MS = 30_000;

	let isLoading = $state(true);
	let note = $state<NoteDetail | null>(null);
	let error = $state('');
	let categories = $state<CategoryRead[]>([]);

	let isAppending = $state(false);
	let liveTitle = $state('');
	let latestContent = $state('');
	let lastSyncedTitle = $state('');
	let lastSyncedContent = $state('');
	let liveColor = $state('');
	let lastSyncedColor = $state('');
	let saveError = $state('');
	let isSaving = $state(false);
	let addCategoryId = $state('');
	let addRelNoteId = $state('');
	let addRelNoteTitle = $state('');
	let addRelType = $state<RelationshipType>('RELATED_TO');

	let showNoteSearchPopup = $state(false);
	let noteSearchQuery = $state('');
	let noteSearchResults = $state<NoteRead[]>([]);
	let noteSearchLoading = $state(false);
	let noteSearchError = $state('');
	let noteSearchDebounce: ReturnType<typeof setTimeout> | null = null;
	let noteSearchInputEl = $state<HTMLInputElement | null>(null);

	let showJumpToBottom = $state(false);
	let showJumpToTop = $state(false);
	let relatedNoteTitles = $state(new SvelteMap<number, string>());
	let lastHydratedNoteId = $state<number | null>(null);

	let saveToastVisible = $state(false);
	let saveToastTimer: ReturnType<typeof setTimeout> | null = null;

	let saveRequestId = 0;
	let saveInFlight: Promise<void> | null = null;
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	function isTitleDirty(): boolean {
		return normalizeNoteTitle(liveTitle) !== normalizeNoteTitle(lastSyncedTitle);
	}

	function isContentDirty(): boolean {
		return normalizeNoteContent(latestContent) !== normalizeNoteContent(lastSyncedContent);
	}

	function isColorDirty(): boolean {
		return normalizeNoteColor(liveColor) !== normalizeNoteColor(lastSyncedColor);
	}

	function isDirtyAgainstBaseline(): boolean {
		return isTitleDirty() || isContentDirty() || isColorDirty();
	}

	let notePageTinted = $derived(normalizeNoteColor(liveColor) !== '');
	let notePageStyle = $derived(noteColorInlineStyle(liveColor));

	function publishNoteToList(updated: NoteRead): void {
		publishNoteListSync({
			id: updated.id,
			title: updated.title,
			content: updated.content,
			type: updated.type,
			pinned: updated.pinned === true,
			color: normalizeNoteColor(updated.color),
			version: updated.version,
			updated_at: updated.updated_at
		});
	}

	function pulseSaveToast() {
		if (saveToastTimer) clearTimeout(saveToastTimer);
		saveToastVisible = true;
		saveToastTimer = setTimeout(() => {
			saveToastVisible = false;
			saveToastTimer = null;
		}, 2400);
	}

	async function flushNoteToServer() {
		if (!note) return;
		if (!isDirtyAgainstBaseline()) return;

		const title = normalizeNoteTitle(liveTitle);
		const content = normalizeNoteContent(latestContent);
		const color = normalizeNoteColor(liveColor);
		const update: NoteUpdate = {};

		if (isTitleDirty()) {
			if (!title) {
				saveError = 'Title is required.';
				return;
			}
			update.title = title;
		}
		if (isContentDirty()) {
			if (!content) {
				saveError = 'Content is required.';
				return;
			}
			update.content = content;
		}
		if (isColorDirty()) {
			update.color = color;
		}

		if (Object.keys(update).length === 0) return;

		const run = (async () => {
			const id = ++saveRequestId;
			saveError = '';
			isSaving = true;
			saveStatus = 'saving';
			try {
				errorLogger.logDebug('Autosaving note', { noteId: note!.id });
				const updated = await apiClient.updateNote(note!.id, update);
				if (id !== saveRequestId) return;
				note = {
					...note!,
					title: updated.title,
					content: updated.content,
					type: updated.type,
					pinned: updated.pinned === true,
					color: normalizeNoteColor(updated.color),
					version: updated.version,
					updated_at: updated.updated_at
				};
				lastSyncedTitle = updated.title;
				lastSyncedContent = updated.content;
				lastSyncedColor = normalizeNoteColor(updated.color);
				publishNoteToList(updated);
				if (!isDefaultNewNote(updated.title, updated.content)) {
					clearDraftNote(note!.id);
				}
				errorLogger.logDebug('Note autosaved', { noteId: note!.id });
				pulseSaveToast();
				saveStatus = 'saved';
			} catch (err) {
				if (id === saveRequestId) {
					saveError = captureApiError(err, {
						component: 'NoteDetail',
						operation: 'autosaveNote',
						noteId: note!.id
					});
					saveStatus = 'error';
				}
			} finally {
				if (id === saveRequestId) isSaving = false;
			}
		})();
		saveInFlight = run;
		try {
			await run;
		} finally {
			if (saveInFlight === run) saveInFlight = null;
		}
	}

	const autosave = debounceTrailing(flushNoteToServer, AUTOSAVE_DEBOUNCE_MS);

	async function ensureNotePersisted(): Promise<void> {
		await autosave.flush();
		if (saveInFlight) {
			await saveInFlight;
		}
		// Re-check: edits may have landed while a save was in flight.
		while (isDirtyAgainstBaseline()) {
			await flushNoteToServer();
			if (saveError) break;
		}
	}

	function onBeforeUnload(event: BeforeUnloadEvent): void {
		if (!note || !isDirtyAgainstBaseline()) return;
		event.preventDefault();
		event.returnValue = '';
	}

	function onVisibilityChange(): void {
		if (document.visibilityState !== 'hidden') return;
		if (!note || !isDirtyAgainstBaseline()) return;
		void ensureNotePersisted();
	}

	beforeNavigate(async ({ cancel }) => {
		await ensureNotePersisted();
		if (note && isDirtyAgainstBaseline()) {
			const msg = saveError
				? 'Changes could not be saved. Leave this page anyway? Unsaved edits will be lost.'
				: 'You have unsaved changes. Leave anyway?';
			if (!confirm(msg)) {
				cancel();
				return;
			}
		}
		if (note && !isDirtyAgainstBaseline()) {
			await cleanupDraftNoteIfUnused(apiClient, note.id, liveTitle, latestContent);
		}
	});

	function scheduleAutosave() {
		saveError = '';
		if (isDirtyAgainstBaseline()) {
			autosave.schedule();
		} else {
			autosave.cancel();
		}
	}

	function onEditorContentChange(value: string) {
		latestContent = value;
		scheduleAutosave();
	}

	$effect(() => {
		if (!note) return;
		if (!isDefaultNewNote(liveTitle, latestContent)) {
			clearDraftNote(note.id);
		}
	});

	$effect(() => {
		const id = note?.id ?? null;
		if (id === null) return;
		if (lastHydratedNoteId !== id) {
			lastHydratedNoteId = id;
			liveTitle = note!.title;
			latestContent = note!.content;
			liveColor = normalizeNoteColor(note!.color);
			lastSyncedTitle = note!.title;
			lastSyncedContent = note!.content;
			lastSyncedColor = normalizeNoteColor(note!.color);
		}
	});

	$effect(() => {
		if (!showNoteSearchPopup) return;
		const q = noteSearchQuery;
		const currentNoteId = note?.id;
		if (noteSearchDebounce) clearTimeout(noteSearchDebounce);
		noteSearchDebounce = setTimeout(async () => {
			noteSearchLoading = true;
			noteSearchError = '';
			try {
				const raw = await apiClient.getNotes(
					q.trim() ? { search: q.trim(), limit: 50 } : { limit: 20 }
				);
				noteSearchResults = filterNotDeleted(raw)
					.filter((n) => currentNoteId == null || n.id !== currentNoteId)
					.map(normalizeNoteRead);
			} catch (err) {
				noteSearchResults = [];
				noteSearchError = captureApiError(err, {
					component: 'NoteDetail',
					operation: 'searchNotes'
				});
			} finally {
				noteSearchLoading = false;
			}
			noteSearchDebounce = null;
		}, 300);
		return () => {
			if (noteSearchDebounce) clearTimeout(noteSearchDebounce);
		};
	});

	async function loadNote(noteId: number): Promise<{
		data: NoteDetail | null;
		error: string;
		relatedTitles: SvelteMap<number, string>;
	}> {
		const empty = {
			data: null as NoteDetail | null,
			error: '',
			relatedTitles: new SvelteMap<number, string>()
		};
		try {
			const noteData = await apiClient.getNote(noteId);
			const normalized: NoteDetail = {
				...noteData,
				pinned: noteData.pinned === true,
				color: normalizeNoteColor(noteData.color)
			};
			const relatedTitles = await buildRelatedTitleMap(apiClient, normalized);
			return { data: normalized, error: '', relatedTitles };
		} catch (err) {
			if (err instanceof HttpError && err.status === 404) {
				return { ...empty, error: 'Note not found.' };
			}
			return {
				...empty,
				error: err instanceof HttpError ? err.message : 'Failed to load note. Please try again.'
			};
		}
	}

	$effect(() => {
		const id = $page.params.id;
		const auth = $isAuthenticated;
		if (!auth) {
			isLoading = false;
			return;
		}
		const noteId = Number(id);
		if (!Number.isInteger(noteId) || noteId < 1) {
			error = 'Invalid note.';
			note = null;
			isLoading = false;
			return;
		}
		isLoading = true;
		error = '';
		note = null;
		relatedNoteTitles = new SvelteMap();
		loadNote(noteId)
			.then(async (r) => {
				const current = get(page);
				if (current.params.id !== String(noteId)) return;
				note = r.data;
				error = r.error;
				relatedNoteTitles = r.relatedTitles;
				if (!r.data) return;
				const wantsAppendFlow =
					current.url.searchParams.get('edit') === '1' ||
					current.url.searchParams.get('edit') === 'true';
				if (!wantsAppendFlow) return;
				// One-shot append: query params are stripped after run; refresh will not re-create the link.
				const appendParam = current.url.searchParams.get('append');
				const appendId = appendParam ? Number(appendParam) : NaN;
				if (Number.isInteger(appendId) && appendId !== noteId) {
					try {
						const newRel = await apiClient.createRelationship({
							note_a_id: appendId,
							note_b_id: noteId,
							type: APPEND_RELATIONSHIP_TYPE
						});
						if (get(page).params.id === String(noteId) && note) {
							note = {
								...note,
								relationships: [...filterNotDeleted(note.relationships), newRel]
							};
							try {
								const appendedFrom = await apiClient.getNote(appendId);
								relatedNoteTitles = new SvelteMap(relatedNoteTitles);
								relatedNoteTitles.set(appendId, appendedFrom.title);
							} catch {
								// Non-blocking best effort for relationship label hydration.
							}
						}
					} catch (err) {
						saveError = captureApiError(err, {
							component: 'NoteDetail',
							operation: 'appendRelationship',
							appendFromNoteId: appendId,
							noteId
						});
					}
				}
				goto(resolve(`/notes/${noteId}`), { replaceState: true });
			})
			.finally(() => {
				if (get(page).params.id === String(noteId)) isLoading = false;
			});
		return () => {
			void autosave.flush();
		};
	});

	onMount(() => {
		if (!$isAuthenticated) {
			isLoading = false;
			return;
		}
		void (async () => {
			try {
				const categoriesData = await apiClient.getCategories({ limit: 1000 });
				categories = filterNotDeleted(categoriesData);
			} catch {
				// Non-blocking
			}
		})();
		updateJumpVisibility();
		const onScroll = () => updateJumpVisibility();
		const onResize = () => updateJumpVisibility();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		window.addEventListener('beforeunload', onBeforeUnload);
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('beforeunload', onBeforeUnload);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	onDestroy(() => {
		if (saveToastTimer) {
			clearTimeout(saveToastTimer);
			saveToastTimer = null;
		}
	});

	$effect(() => {
		void note?.id;
		void isLoading;
		void error;
		if (!browser) return;
		updateJumpVisibility();
	});

	function openNoteSearchPopup() {
		showNoteSearchPopup = true;
		noteSearchQuery = '';
		noteSearchResults = [];
		noteSearchError = '';
		setTimeout(() => noteSearchInputEl?.focus(), 0);
	}

	function closeNoteSearchPopup() {
		showNoteSearchPopup = false;
		noteSearchQuery = '';
		noteSearchResults = [];
		noteSearchError = '';
	}

	async function selectNoteFromSearch(selected: NoteRead) {
		addRelNoteId = String(selected.id);
		addRelNoteTitle = selected.title;
		noteSearchError = '';
		const ok = await addRelationship();
		if (ok) {
			closeNoteSearchPopup();
		} else {
			noteSearchError = saveError || 'Could not add relationship.';
		}
	}

	function handleNoteSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeNoteSearchPopup();
	}

	async function appendNoteFromDetail() {
		if (!note || isAppending || isSaving) return;
		isAppending = true;
		saveError = '';
		errorLogger.logDebug('Appending note from detail', { appendFromNoteId: note.id });
		const result = await createNoteAndNavigate({
			apiClient,
			goto,
			resolve,
			appendFromNoteId: note.id
		});
		if (result.success) {
			errorLogger.logDebug('Append note created successfully from detail', {
				sourceNoteId: note.id,
				newNoteId: result.note.id
			});
		} else {
			saveError = captureApiError(new Error(result.error), {
				component: 'NoteDetail',
				operation: 'appendNoteFromDetail',
				sourceNoteId: note.id
			});
		}
		isAppending = false;
	}

	async function addCategory() {
		if (!note || !addCategoryId) return;
		const categoryId = Number(addCategoryId);
		if (!Number.isInteger(categoryId)) return;
		isSaving = true;
		saveError = '';
		try {
			await apiClient.addCategoryToNote(note.id, categoryId);
			const selectedCategory = categories.find((category) => category.id === categoryId);
			if (selectedCategory) {
				note = {
					...note,
					categories: [...filterNotDeleted(note.categories), selectedCategory]
				};
			}
			addCategoryId = '';
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'addCategory',
				noteId: note.id,
				categoryId
			});
		} finally {
			isSaving = false;
		}
	}

	async function removeCategory(categoryId: number) {
		if (!note) return;
		isSaving = true;
		saveError = '';
		try {
			errorLogger.logDebug('Removing category from note', { noteId: note.id, categoryId });
			await apiClient.removeCategoryFromNote(note.id, categoryId);
			note = {
				...note,
				categories: filterNotDeleted(note.categories).filter(
					(category) => category.id !== categoryId
				)
			};
			errorLogger.logDebug('Category removed successfully', { noteId: note.id, categoryId });
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'removeCategory',
				noteId: note.id,
				categoryId
			});
		} finally {
			isSaving = false;
		}
	}

	async function addRelationship(): Promise<boolean> {
		if (!note) return false;
		const otherId = Number(addRelNoteId);
		if (!Number.isInteger(otherId) || otherId === note.id) {
			saveError = 'Enter a valid different note ID.';
			return false;
		}
		isSaving = true;
		saveError = '';
		try {
			const newRel = await apiClient.createRelationship({
				note_a_id: note.id,
				note_b_id: otherId,
				type: addRelType
			});
			const existing = filterNotDeleted(note.relationships);
			note = {
				...note,
				relationships: [...existing, newRel]
			};
			if (addRelNoteTitle) {
				relatedNoteTitles = new SvelteMap(relatedNoteTitles);
				relatedNoteTitles.set(otherId, addRelNoteTitle);
			}
			addRelNoteId = '';
			addRelNoteTitle = '';
			addRelType = 'RELATED_TO';
			return true;
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'addRelationship',
				noteId: note.id
			});
			return false;
		} finally {
			isSaving = false;
		}
	}

	async function removeRelationship(rel: RelationshipRead) {
		if (!note) return;
		isSaving = true;
		saveError = '';
		try {
			errorLogger.logDebug('Removing relationship', {
				noteId: note.id,
				relId: `${rel.note_a_id}-${rel.note_b_id}-${rel.type}`
			});
			await apiClient.deleteRelationship(rel.note_a_id, rel.note_b_id);
			const nextRelationships = filterNotDeleted(note.relationships).filter(
				(existing) =>
					!(
						existing.note_a_id === rel.note_a_id &&
						existing.note_b_id === rel.note_b_id &&
						existing.type === rel.type
					)
			);
			note = {
				...note,
				relationships: nextRelationships
			};
			errorLogger.logDebug('Relationship removed successfully', { noteId: note.id });
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'removeRelationship',
				noteId: note.id,
				relId: `${rel.note_a_id}-${rel.note_b_id}-${rel.type}`
			});
		} finally {
			isSaving = false;
		}
	}

	async function deleteNote() {
		if (!note) return;
		if (isSaving) return;
		isSaving = true;
		if (!(await confirmAction('Delete this note? This cannot be undone.'))) {
			isSaving = false;
			return;
		}
		saveError = '';
		try {
			await ensureNotePersisted();
			await apiClient.deleteNote(note.id);
			await goto(resolve('/notes'));
		} catch (err) {
			saveError = err instanceof HttpError ? err.message : 'Failed to delete note.';
		} finally {
			isSaving = false;
		}
	}

	async function toggleNotePinned() {
		if (!note) return;
		if (isSaving) return;
		saveError = '';
		isSaving = true;
		try {
			await ensureNotePersisted();
			errorLogger.logDebug('Toggling note pin from detail', {
				noteId: note.id,
				nextPinned: !note.pinned
			});
			const updated = await apiClient.updateNote(note.id, { pinned: !note.pinned });
			note = {
				...note,
				pinned: updated.pinned === true,
				color: normalizeNoteColor(updated.color),
				version: updated.version,
				updated_at: updated.updated_at
			};
			publishNoteToList(updated);
			errorLogger.logDebug('Note pin toggled from detail', { noteId: note.id });
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'toggleNotePinned',
				noteId: note.id
			});
		} finally {
			isSaving = false;
		}
	}

	function updateJumpVisibility() {
		if (!browser || isLoading || !!error || !note) {
			showJumpToBottom = false;
			showJumpToTop = false;
			return;
		}
		const doc = document.documentElement;
		const body = document.body;
		const totalHeight = Math.max(doc.scrollHeight, body.scrollHeight);
		const viewportHeight = window.innerHeight;
		const scrollTop = window.scrollY || doc.scrollTop || 0;
		const isLongContent = totalHeight > viewportHeight + 120;
		const nearBottom = scrollTop + viewportHeight >= totalHeight - 120;
		const nearTop = scrollTop <= 120;
		showJumpToBottom = isLongContent && !nearBottom;
		showJumpToTop = isLongContent && !nearTop;
	}

	function jumpToBottom() {
		if (!browser) return;
		window.scrollTo({
			top: document.documentElement.scrollHeight,
			behavior: 'smooth'
		});
	}

	function jumpToTop() {
		if (!browser) return;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	let filteredCategories = $derived(filterNotDeleted(note?.categories));
	let filteredRelationships = $derived(filterNotDeleted(note?.relationships));
	let availableCategories = $derived(
		note ? categories.filter((c) => !filteredCategories.some((fc) => fc.id === c.id)) : []
	);

	let documentTitle = $derived(
		note ? `${liveTitle.trim() || note.title} – Notes` : 'Note – Flit Web'
	);
	let documentDescription = $derived(note ? liveTitle.trim() || note.title : 'Note detail');
</script>

<SeoHead title={documentTitle} description={documentDescription} />
<div class="note-page" class:note-page--tinted={notePageTinted} style={notePageStyle}>
	<a href={resolve('/notes')} class="mt-sm note-page__back-link">← Back to Notes</a>
	{#if isLoading}
		<div class="card">
			<p class="loading loading--inline-start">
				<LoadingSpinner />
				<span>Loading note…</span>
			</p>
		</div>
	{:else if error}
		<div class="note-error">
			<p class="section-title">Could not load note</p>
			<p class="card__meta">{error}</p>
		</div>
	{:else if note}
		<article class="note-detail">
			<NoteDetailHeader
				{note}
				{liveTitle}
				{isSaving}
				{isAppending}
				{saveError}
				{saveStatus}
				onTitleChange={(value) => {
					liveTitle = value;
					scheduleAutosave();
				}}
				onAppend={appendNoteFromDetail}
				onTogglePin={() => void toggleNotePinned()}
				onDelete={deleteNote}
			/>

			<div class="note-detail__body">
				{#if browser}
					{#key note.id}
						{#if NoteBodyEditor}
							<NoteBodyEditor
								noteId={note.id}
								initialContent={note.content}
								onChange={onEditorContentChange}
							/>
						{:else}
							<p class="card__meta">Loading editor…</p>
						{/if}
					{/key}
				{/if}
			</div>

			<NoteCategoriesPanel
				categories={filteredCategories}
				{availableCategories}
				{addCategoryId}
				{isSaving}
				onAddCategoryIdChange={(id) => (addCategoryId = id)}
				onAddCategory={addCategory}
				onRemoveCategory={removeCategory}
			/>

			<NoteRelationshipsPanel
				{note}
				relationships={filteredRelationships}
				{relatedNoteTitles}
				{addRelType}
				{isSaving}
				onAddRelTypeChange={(t) => (addRelType = t)}
				onOpenSearch={openNoteSearchPopup}
				onRemoveRelationship={removeRelationship}
			/>

			<NoteColorSlider
				{liveColor}
				disabled={isSaving}
				onColorChange={(hex) => {
					liveColor = hex;
					scheduleAutosave();
				}}
			/>
		</article>
	{/if}
</div>

{#if browser && saveToastVisible}
	<div class="note-save-toast" role="status" aria-live="polite">...updated</div>
{/if}

{#if showJumpToTop || showJumpToBottom}
	<div class="note-page__jump-nav">
		{#if showJumpToTop}
			<button
				type="button"
				onclick={jumpToTop}
				class="btn note-page__jump-btn"
				aria-label="Jump to top"
				title="Jump to top"
			>
				<svg class="icon_sm" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M6 15l6-6 6 6"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		{/if}
		{#if showJumpToBottom}
			<button
				type="button"
				onclick={jumpToBottom}
				class="btn note-page__jump-btn"
				aria-label="Jump to bottom"
				title="Jump to bottom"
			>
				<svg class="icon_sm" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M6 9l6 6 6-6"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		{/if}
	</div>
{/if}

<NoteSearchPopup
	open={showNoteSearchPopup}
	query={noteSearchQuery}
	results={noteSearchResults}
	loading={noteSearchLoading}
	error={noteSearchError}
	bind:inputEl={noteSearchInputEl}
	onQueryChange={(v) => (noteSearchQuery = v)}
	onSelect={selectNoteFromSearch}
	onClose={closeNoteSearchPopup}
	onKeydown={handleNoteSearchKeydown}
/>
