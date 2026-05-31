<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { isAuthenticated } from '$lib/stores/auth';
	import {
		applyNoteListSyncPatch,
		noteListSync,
		type NoteListSyncPatch
	} from '$lib/stores/noteListSync';
	import { apiClient } from '$lib/api/client';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import NoteListCard from '$lib/components/notes/NoteListCard.svelte';
	import NotesCategoryManager from '$lib/components/notes/NotesCategoryManager.svelte';
	import NotesSearchFilters from '$lib/components/notes/NotesSearchFilters.svelte';
	import { filterNotDeleted } from '$lib/utils/filter';
	import { errorLogger, captureApiError } from '$lib/utils/error-handler';
	import { getCachedNotePreviewHtml } from '$lib/utils/markdown-preview-cache';
	import { normalizeNoteRead, normalizeNotesPage } from '$lib/utils/notes';
	import { debounceTrailing } from '$lib/utils/debounce';
	import { confirmAction } from '$lib/stores/confirmDialog';
	import { createNoteAndNavigate } from '$lib/utils/note-create';
	import type { NoteRead, CategoryRead } from '$lib/types/note';

	const notesListPath = resolve('/notes');

	function isNotesListPath(pathname: string): boolean {
		return pathname === notesListPath || pathname === `${notesListPath}/`;
	}

	function mergeLoadedNotes(pageNotes: NoteRead[]): NoteRead[] {
		const patch = get(noteListSync);
		if (!patch) return pageNotes;
		return applyNoteListSyncPatch(pageNotes, patch) ?? pageNotes;
	}

	function applyListSyncPatch(patch: NoteListSyncPatch): void {
		const merged = applyNoteListSyncPatch(notes, patch);
		if (!merged) return;
		notes = sortNotesPinnedThenUpdated(merged);
	}

	const previewHtmlByNoteId = $derived.by(() => {
		const m: Record<number, string> = {};
		for (const n of notes) {
			m[n.id] = getCachedNotePreviewHtml(n.id, n.content ?? '');
		}
		return m;
	});

	function hasPreview(content: string): boolean {
		if (!content?.trim()) return false;
		return content.split('\n').slice(0, 3).join('\n').trim().length > 0;
	}

	let isLoading = $state(true);
	let notes = $state<NoteRead[]>([]);
	let pinnedNotes = $derived(notes.filter((n) => n.pinned));
	let unpinnedNotes = $derived(notes.filter((n) => !n.pinned));
	let categories = $state<CategoryRead[]>([]);
	let error = $state('');
	const PAGE_SIZE = 10;
	let skip = $state(0);
	let hasMore = $state(true);
	let isLoadingMore = $state(false);
	let loadGeneration = 0;
	let loadMoreSentinel = $state<HTMLDivElement | null>(null);

	// Search and filter state
	let searchQuery = $state('');
	let selectedCategory = $state('');
	const reloadNotesDebounced = debounceTrailing(() => resetAndLoadNotes(), 400);

	// Category create/delete
	let showCreateCategory = $state(false);
	let newCategoryName = $state('');
	let categoryError = $state('');
	let isCategoryBusy = $state(false);

	// New note
	let isCreatingNote = $state(false);
	let failedCreateNoteId = $state<number | null>(null);

	// Per-note actions
	let isAppendingNoteId = $state<number | null>(null);
	let isPinningNoteId = $state<number | null>(null);
	let activeOptionsNoteId = $state<number | null>(null);
	let notesRouteActive = $state(false);

	function dedupeById(existing: NoteRead[], incoming: NoteRead[]): NoteRead[] {
		const seen = new Set(existing.map((note) => note.id));
		return incoming.filter((note) => !seen.has(note.id));
	}

	function sortNotesPinnedThenUpdated(items: NoteRead[]): NoteRead[] {
		return [...items].sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
			return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		});
	}

	async function loadNotesPage({ reset }: { reset: boolean }) {
		if (!$isAuthenticated) return;
		if (!reset && (isLoading || isLoadingMore || !hasMore)) {
			errorLogger.logDebug('Skipping load-more request', {
				reason: isLoading
					? 'initial-loading'
					: isLoadingMore
						? 'already-loading-more'
						: 'no-more-pages',
				skip,
				hasMore,
				isLoading,
				isLoadingMore
			});
			return;
		}

		const currentGeneration = reset ? ++loadGeneration : loadGeneration;
		const pageSkip = reset ? 0 : skip;

		if (reset) {
			isLoading = true;
			error = '';
			notes = [];
			skip = 0;
			hasMore = true;
			errorLogger.logDebug('Resetting notes pagination state', {
				search: searchQuery || null,
				filter: selectedCategory || null,
				pageSize: PAGE_SIZE,
				generation: currentGeneration
			});
		} else {
			isLoadingMore = true;
			errorLogger.logInfo('Loading more notes', {
				component: 'NotesList',
				operation: 'loadMoreNotes',
				skip: pageSkip,
				limit: PAGE_SIZE,
				alreadyLoaded: notes.length
			});
			errorLogger.logDebug('Starting load-more request', {
				skip: pageSkip,
				pageSize: PAGE_SIZE,
				alreadyLoaded: notes.length,
				generation: currentGeneration
			});
		}

		try {
			errorLogger.logDebug('Loading notes page', {
				search: searchQuery,
				filter: selectedCategory,
				skip: pageSkip,
				limit: PAGE_SIZE
			});
			const raw = await apiClient.getNotes({
				skip: pageSkip,
				limit: PAGE_SIZE,
				search: searchQuery || undefined,
				filter: selectedCategory || undefined
			});

			if (currentGeneration !== loadGeneration) {
				errorLogger.logDebug('Ignoring stale notes response', {
					responseGeneration: currentGeneration,
					activeGeneration: loadGeneration,
					reset,
					skip: pageSkip
				});
				return;
			}

			const pageNotes = mergeLoadedNotes(normalizeNotesPage(raw));
			if (reset) {
				notes = pageNotes;
			} else {
				notes = [...notes, ...dedupeById(notes, pageNotes)];
			}

			skip = pageSkip + pageNotes.length;
			hasMore = pageNotes.length === PAGE_SIZE;
			if (!reset) {
				errorLogger.logInfo('Load-more completed', {
					component: 'NotesList',
					operation: 'loadMoreNotes',
					added: pageNotes.length,
					totalLoaded: notes.length,
					nextSkip: skip,
					hasMore
				});
			}
			errorLogger.logDebug('Notes page loaded successfully', {
				mode: reset ? 'reset' : 'append',
				pageCount: pageNotes.length,
				totalLoaded: notes.length,
				hasMore,
				nextSkip: skip
			});
		} catch (err) {
			if (currentGeneration !== loadGeneration) return;
			error = captureApiError(err, {
				component: 'NotesList',
				operation: reset ? 'loadNotes' : 'loadMoreNotes',
				search: searchQuery,
				filter: selectedCategory,
				skip: pageSkip,
				limit: PAGE_SIZE
			});
		} finally {
			if (currentGeneration === loadGeneration) {
				if (reset) {
					isLoading = false;
				} else {
					isLoadingMore = false;
				}
			}
		}
	}

	async function resetAndLoadNotes() {
		errorLogger.logDebug('Requesting notes reset+load', {
			search: searchQuery || null,
			filter: selectedCategory || null
		});
		await loadNotesPage({ reset: true });
	}

	async function loadMoreNotes() {
		errorLogger.logDebug('Requesting notes load-more', {
			skip,
			hasMore,
			isLoading,
			isLoadingMore
		});
		await loadNotesPage({ reset: false });
	}

	function handleSearchInput(event: Event) {
		searchQuery = (event.target as HTMLInputElement).value;
		reloadNotesDebounced.schedule();
	}

	function handleCategoryChange(event: Event) {
		selectedCategory = (event.target as HTMLSelectElement).value;
		reloadNotesDebounced.schedule();
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedCategory = '';
		resetAndLoadNotes();
	}

	// Check if any filters are active
	let hasActiveFilters = $derived(searchQuery !== '' || selectedCategory !== '');

	// Resolve selected category id for delete
	let selectedCategoryId = $derived(
		selectedCategory ? categories.find((c) => c.name === selectedCategory)?.id : undefined
	);

	async function fetchCategories() {
		if (!$isAuthenticated) return;
		try {
			errorLogger.logDebug('Loading categories');
			const rawCategories = await apiClient.getCategories({ limit: 1000 });
			categories = filterNotDeleted(rawCategories);
			errorLogger.logDebug('Categories loaded successfully', { count: categories.length });
		} catch (err) {
			captureApiError(err, { component: 'NotesList', operation: 'loadCategories' });
			// Don't set error message for categories - it's not critical for note list
		}
	}

	function openCreateCategory() {
		showCreateCategory = true;
		newCategoryName = '';
		categoryError = '';
	}

	function cancelCreateCategory() {
		showCreateCategory = false;
		newCategoryName = '';
		categoryError = '';
	}

	async function submitCreateCategory() {
		const name = newCategoryName.trim();
		if (!name) {
			categoryError = 'Name is required.';
			return;
		}
		isCategoryBusy = true;
		categoryError = '';
		try {
			errorLogger.logDebug('Creating category', { name });
			const created = await apiClient.createCategory({ name });
			categories = [...filterNotDeleted(categories), created];
			showCreateCategory = false;
			newCategoryName = '';
			errorLogger.logDebug('Category created successfully', { categoryId: created.id });
		} catch (err) {
			categoryError = captureApiError(err, {
				component: 'NotesList',
				operation: 'createCategory',
				categoryName: name
			});
		} finally {
			isCategoryBusy = false;
		}
	}

	async function deleteSelectedCategory() {
		const id = selectedCategoryId;
		const name = selectedCategory;
		if (id === undefined || !name) return;
		if (!(await confirmAction(`Delete category "${name}"?`))) return;
		isCategoryBusy = true;
		categoryError = '';
		try {
			errorLogger.logDebug('Deleting category', { categoryId: id });
			await apiClient.deleteCategory(id);
			selectedCategory = '';
			await fetchCategories();
			await resetAndLoadNotes();
			errorLogger.logDebug('Category deleted successfully', { categoryId: id });
		} catch (err) {
			categoryError = captureApiError(err, {
				component: 'NotesList',
				operation: 'deleteCategory',
				categoryId: id
			});
		} finally {
			isCategoryBusy = false;
		}
	}

	async function createNewNote() {
		if (!$isAuthenticated) return;
		isCreatingNote = true;
		error = '';
		failedCreateNoteId = null;
		errorLogger.logDebug('Creating new note');
		const result = await createNoteAndNavigate({ apiClient, goto, resolve });
		if (result.success) {
			errorLogger.logDebug('New note created successfully', { noteId: result.note.id });
		} else {
			error = captureApiError(new Error(result.error), {
				component: 'NotesList',
				operation: 'createNote'
			});
			if (result.createdNoteId != null) failedCreateNoteId = result.createdNoteId;
		}
		isCreatingNote = false;
	}

	async function appendNote(oldNoteId: number) {
		if (!$isAuthenticated || isAppendingNoteId != null) return;
		isAppendingNoteId = oldNoteId;
		error = '';
		failedCreateNoteId = null;
		errorLogger.logDebug('Appending note', { appendFromNoteId: oldNoteId });
		const result = await createNoteAndNavigate({
			apiClient,
			goto,
			resolve,
			appendFromNoteId: oldNoteId
		});
		if (result.success) {
			errorLogger.logDebug('Append note created successfully', {
				sourceNoteId: oldNoteId,
				newNoteId: result.note.id
			});
		} else {
			error = captureApiError(new Error(result.error), {
				component: 'NotesList',
				operation: 'appendNote',
				sourceNoteId: oldNoteId
			});
			if (result.createdNoteId != null) failedCreateNoteId = result.createdNoteId;
		}
		isAppendingNoteId = null;
	}

	async function deleteFailedDraftNote() {
		if (failedCreateNoteId == null) return;
		try {
			await apiClient.deleteNote(failedCreateNoteId);
			failedCreateNoteId = null;
			error = '';
		} catch (err) {
			error = captureApiError(err, {
				component: 'NotesList',
				operation: 'deleteFailedDraftNote'
			});
		}
	}

	function openFailedDraftNote() {
		if (failedCreateNoteId == null) return;
		void goto(resolve(`/notes/${failedCreateNoteId}?edit=1`));
	}

	function toggleNoteOptions(noteId: number) {
		activeOptionsNoteId = activeOptionsNoteId === noteId ? null : noteId;
	}

	async function deleteNote(noteId: number, noteTitle: string) {
		if (!$isAuthenticated) return;
		if (!(await confirmAction(`Delete note "${noteTitle}"? This cannot be undone.`))) return;
		error = '';
		try {
			errorLogger.logDebug('Deleting note', { noteId });
			await apiClient.deleteNote(noteId);
			notes = notes.filter((n) => n.id !== noteId);
			if (hasMore && notes.length < PAGE_SIZE) {
				await loadMoreNotes();
			}
			errorLogger.logDebug('Note deleted successfully', { noteId });
		} catch (err) {
			error = captureApiError(err, {
				component: 'NotesList',
				operation: 'deleteNote',
				noteId
			});
		}
	}

	function closeNoteOptions() {
		activeOptionsNoteId = null;
	}

	async function togglePin(noteItem: NoteRead) {
		if (!$isAuthenticated) return;
		if (isPinningNoteId != null) return;
		isPinningNoteId = noteItem.id;
		error = '';
		try {
			errorLogger.logDebug('Toggling note pin', {
				noteId: noteItem.id,
				nextPinned: !noteItem.pinned
			});
			const updated = await apiClient.updateNote(noteItem.id, { pinned: !noteItem.pinned });
			notes = sortNotesPinnedThenUpdated(
				notes.map((n) => (n.id === noteItem.id ? normalizeNoteRead({ ...n, ...updated }) : n))
			);
			closeNoteOptions();
			errorLogger.logDebug('Note pin toggled', { noteId: noteItem.id });
		} catch (err) {
			error = captureApiError(err, {
				component: 'NotesList',
				operation: 'togglePin',
				noteId: noteItem.id
			});
		} finally {
			isPinningNoteId = null;
		}
	}

	onMount(async () => {
		if (!$isAuthenticated) {
			isLoading = false;
			return;
		}

		await fetchCategories();
		const categoryParam = $page.url.searchParams.get('category');
		if (categoryParam) {
			selectedCategory = decodeURIComponent(categoryParam);
		}
	});

	$effect(() => {
		if (!$isAuthenticated || !isNotesListPath($page.url.pathname)) {
			notesRouteActive = false;
			return;
		}
		const returning = notesRouteActive;
		notesRouteActive = true;
		if (!returning) {
			void resetAndLoadNotes();
		}
	});

	$effect(() => {
		const patch = $noteListSync;
		if (!patch || notes.length === 0) return;
		applyListSyncPatch(patch);
	});

	$effect(() => {
		if (typeof IntersectionObserver === 'undefined' || !loadMoreSentinel) return;
		errorLogger.logDebug('Setting up notes load-more observer', {
			rootMargin: '300px 0px',
			threshold: 0
		});
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						errorLogger.logInfo('Load-more sentinel intersected', {
							component: 'NotesList',
							operation: 'observeLoadMoreSentinel',
							skip,
							hasMore,
							isLoading,
							isLoadingMore
						});
						errorLogger.logDebug('Load-more sentinel intersected', {
							skip,
							hasMore,
							isLoading,
							isLoadingMore
						});
						loadMoreNotes();
					}
				}
			},
			{
				root: null,
				rootMargin: '300px 0px',
				threshold: 0
			}
		);
		observer.observe(loadMoreSentinel);

		return () => {
			errorLogger.logDebug('Tearing down notes load-more observer');
			observer.disconnect();
		};
	});

	onDestroy(() => {
		reloadNotesDebounced.cancel();
	});
</script>

<svelte:head>
	<title>Notes – Flit Web</title>
</svelte:head>
<svelte:window
	onclick={() => {
		if (activeOptionsNoteId !== null) closeNoteOptions();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && activeOptionsNoteId !== null) {
			closeNoteOptions();
		}
	}}
/>

<h1>Notes</h1>

<section class="card">
	<NotesSearchFilters
		{searchQuery}
		{selectedCategory}
		{categories}
		{hasActiveFilters}
		{isCategoryBusy}
		{selectedCategoryId}
		onSearchInput={handleSearchInput}
		onCategoryChange={handleCategoryChange}
		onClearFilters={clearFilters}
		onOpenCreateCategory={openCreateCategory}
		onDeleteSelectedCategory={deleteSelectedCategory}
	/>
	<NotesCategoryManager
		{showCreateCategory}
		{newCategoryName}
		{categoryError}
		{isCategoryBusy}
		onNameInput={(v) => (newCategoryName = v)}
		onSubmit={submitCreateCategory}
		onCancel={cancelCreateCategory}
	/>
</section>

<div class="card__row card__row--end mt-md">
	<button type="button" onclick={createNewNote} disabled={isCreatingNote} class="btn btn-primary">
		+ New Note
	</button>
</div>

{#if isLoading}
	<div class="loading">
		<LoadingSpinner />
		<span>Loading notes...</span>
	</div>
{:else if error}
	<div class="card card__block">
		<p class="section-title">Could not load notes</p>
		<p class="card__meta">{error}</p>
		{#if failedCreateNoteId != null}
			<div class="card__actions">
				<button type="button" class="btn btn-secondary" onclick={openFailedDraftNote}>
					Open draft note
				</button>
				<button type="button" class="btn btn-danger" onclick={deleteFailedDraftNote}>
					Delete draft
				</button>
			</div>
		{/if}
	</div>
{:else if notes.length === 0}
	<div class="card card__column card__column--center">
		{#if hasActiveFilters}
			<span class="icon_md" aria-hidden="true">
				<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</span>
			<p class="card__meta card__meta--mt-sm">No notes match your filters.</p>
			<button type="button" onclick={clearFilters} class="btn btn-primary mt-md"
				>Clear filters</button
			>
		{:else}
			<p class="card__meta">No notes yet.</p>
		{/if}
	</div>
{:else}
	<p class="muted">
		{notes.length} note{notes.length === 1 ? '' : 's'}
	</p>
	{#if pinnedNotes.length > 0}
		<section class="notes-pinned" aria-label="Pinned notes">
			<h2 class="notes-pinned__title">Pinned</h2>
			<div class="notes-pinned__list">
				{#each pinnedNotes as note (note.id)}
					<NoteListCard
						{note}
						previewHtml={previewHtmlByNoteId[note.id] ?? ''}
						showPreview={hasPreview(note.content)}
						isOptionsOpen={activeOptionsNoteId === note.id}
						isPinning={isPinningNoteId != null}
						isAppending={isAppendingNoteId === note.id}
						onToggleOptions={(e) => {
							e.preventDefault();
							e.stopPropagation();
							toggleNoteOptions(note.id);
						}}
						onTogglePin={() => void togglePin(note)}
						onAppend={() => {
							appendNote(note.id);
							closeNoteOptions();
						}}
						onDelete={() => {
							deleteNote(note.id, note.title);
							closeNoteOptions();
						}}
						onCloseOptions={closeNoteOptions}
					/>
				{/each}
			</div>
		</section>
	{/if}
	{#each unpinnedNotes as note (note.id)}
		<NoteListCard
			{note}
			previewHtml={previewHtmlByNoteId[note.id] ?? ''}
			showPreview={hasPreview(note.content)}
			isOptionsOpen={activeOptionsNoteId === note.id}
			isPinning={isPinningNoteId != null}
			isAppending={isAppendingNoteId === note.id}
			onToggleOptions={(e) => {
				e.preventDefault();
				e.stopPropagation();
				toggleNoteOptions(note.id);
			}}
			onTogglePin={() => void togglePin(note)}
			onAppend={() => {
				appendNote(note.id);
				closeNoteOptions();
			}}
			onDelete={() => {
				deleteNote(note.id, note.title);
				closeNoteOptions();
			}}
			onCloseOptions={closeNoteOptions}
		/>
	{/each}
	{#if isLoadingMore}
		<p class="muted">Loading more notes...</p>
	{/if}
	{#if hasMore && !isLoading && !isLoadingMore}
		<div class="card__row card__row--center mt-sm">
			<button type="button" class="btn btn-secondary" onclick={() => loadMoreNotes()}>
				Load more notes
			</button>
		</div>
	{/if}
	{#if hasMore && !isLoading}
		<div bind:this={loadMoreSentinel} aria-hidden="true"></div>
	{/if}
{/if}
