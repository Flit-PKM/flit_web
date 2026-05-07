<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient } from '$lib/api/client';
	import { filterNotDeleted } from '$lib/utils/filter';
	import { errorLogger, captureApiError } from '$lib/utils/error-handler';
	import { markdownToSafeHtml } from '$lib/utils/markdown';
	import type { NoteRead, CategoryRead } from '$lib/types/note';

	const previewHtmlByNoteId = $derived.by(() => {
		const m: Record<number, string> = {};
		for (const n of notes) {
			m[n.id] = markdownToSafeHtml(n.content ?? '', { maxLines: 5 });
		}
		return m;
	});

	function hasPreview(content: string): boolean {
		if (!content?.trim()) return false;
		return content.split('\n').slice(0, 3).join('\n').trim().length > 0;
	}

	let isLoading = $state(true);
	let notes = $state<NoteRead[]>([]);
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
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Category create/delete
	let showCreateCategory = $state(false);
	let newCategoryName = $state('');
	let categoryError = $state('');
	let isCategoryBusy = $state(false);

	// New note
	let isCreatingNote = $state(false);

	// Per-note actions
	let isAppendingNoteId = $state<number | null>(null);
	let activeOptionsNoteId = $state<number | null>(null);

	// Fetch notes with current filters
	function dedupeById(existing: NoteRead[], incoming: NoteRead[]): NoteRead[] {
		const seen = new Set(existing.map((note) => note.id));
		return incoming.filter((note) => !seen.has(note.id));
	}

	function sortByUpdatedAtDesc(items: NoteRead[]): NoteRead[] {
		return items.sort(
			(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
		);
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

			const pageNotes = sortByUpdatedAtDesc(filterNotDeleted(raw));
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

	// Debounced search handler
	function handleSearchInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		searchQuery = value;

		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		// Debounce the search
		searchTimeout = setTimeout(() => {
			resetAndLoadNotes();
		}, 1000);
	}

	// Category filter handler
	function handleCategoryChange(event: Event) {
		selectedCategory = (event.target as HTMLSelectElement).value;
		resetAndLoadNotes();
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
		if (!confirm(`Delete category "${name}"?`)) return;
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
		try {
			errorLogger.logDebug('Creating new note');
			const created = await apiClient.createNote({ title: 'New note', content: 'Note Content' });
			goto(resolve(`/notes/${created.id}?edit=1`));
			errorLogger.logDebug('New note created successfully', { noteId: created.id });
		} catch (err) {
			error = captureApiError(err, {
				component: 'NotesList',
				operation: 'createNote'
			});
		} finally {
			isCreatingNote = false;
		}
	}

	async function appendNote(oldNoteId: number) {
		if (!$isAuthenticated || isAppendingNoteId != null) return;
		isAppendingNoteId = oldNoteId;
		error = '';
		try {
			errorLogger.logDebug('Appending note', { appendFromNoteId: oldNoteId });
			const created = await apiClient.createNote({ title: 'New note', content: 'Note Content' });
			goto(resolve(`/notes/${created.id}?edit=1&append=${oldNoteId}`));
			errorLogger.logDebug('Append note created successfully', {
				sourceNoteId: oldNoteId,
				newNoteId: created.id
			});
		} catch (err) {
			error = captureApiError(err, {
				component: 'NotesList',
				operation: 'appendNote',
				sourceNoteId: oldNoteId
			});
		} finally {
			isAppendingNoteId = null;
		}
	}

	function toggleNoteOptions(noteId: number) {
		activeOptionsNoteId = activeOptionsNoteId === noteId ? null : noteId;
	}

	async function deleteNote(noteId: number, noteTitle: string) {
		if (!$isAuthenticated) return;
		if (!confirm(`Delete note "${noteTitle}"? This cannot be undone.`)) return;
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
		await resetAndLoadNotes();
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
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
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
	<div class="notes-toolbar">
		<div class="notes-toolbar__row">
			<span class="notes-toolbar__icon" aria-hidden="true">
				<svg fill="none" class="icon_md" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			</span>
			<div class="notes-toolbar__grow">
				<input
					type="text"
					placeholder="Search notes..."
					value={searchQuery}
					oninput={handleSearchInput}
					class="input wide"
				/>
			</div>
		</div>

		<div class="notes-toolbar__row">
			<label for="category-filter" class="notes-toolbar__label nowrap">Category</label>
			<div class="notes-toolbar__grow">
				<select
					id="category-filter"
					value={selectedCategory}
					onchange={handleCategoryChange}
					class="input wide"
				>
					<option value="">All categories</option>
					{#each categories as category (category.id)}
						<option value={category.name}>{category.name}</option>
					{/each}
				</select>
			</div>
			<div class="profile-section__row">
				<button
					type="button"
					onclick={openCreateCategory}
					disabled={isCategoryBusy}
					class="btn"
					title="Create category">+</button
				>
				<button
					type="button"
					onclick={deleteSelectedCategory}
					disabled={selectedCategoryId === undefined || isCategoryBusy}
					class="btn"
					title="Delete selected category">−</button
				>
				{#if hasActiveFilters}
					<button type="button" onclick={clearFilters} class="btn"> Clear </button>
				{/if}
			</div>
		</div>
	</div>

	{#if showCreateCategory}
		<div class="card__row card__row--start">
			<input
				type="text"
				bind:value={newCategoryName}
				placeholder="New category name"
				class="input"
				onkeydown={(e) => e.key === 'Enter' && submitCreateCategory()}
			/>
			<button
				type="button"
				onclick={submitCreateCategory}
				disabled={isCategoryBusy}
				class="btn btn-primary">Create</button
			>
			<button
				type="button"
				onclick={cancelCreateCategory}
				disabled={isCategoryBusy}
				class="btn btn-secondary">Cancel</button
			>
			{#if categoryError}
				<span class="form-group__error">{categoryError}</span>
			{/if}
		</div>
	{/if}

	{#if hasActiveFilters}
		<div class="profile-section__row mt-sm">
			<span>Filtering by:</span>
			{#if searchQuery}
				<span class="badge badge--primary">Search: "{searchQuery}"</span>
			{/if}
			{#if selectedCategory}
				<span class="badge badge--primary">Category: {selectedCategory}</span>
			{/if}
		</div>
	{/if}
</section>

<div class="card__row card__row--end mt-md">
	<button type="button" onclick={createNewNote} disabled={isCreatingNote} class="btn btn-primary">
		+ New Note
	</button>
</div>

{#if isLoading}
	<div class="loading">
		<span class="loading__spinner" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle
					class="loading__spinner-inner"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				></circle>
				<path
					class="loading__spinner-path"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		</span>
		<span>Loading notes...</span>
	</div>
{:else if error}
	<div class="card card__block">
		<p class="section-title">Could not load notes</p>
		<p class="card__meta">{error}</p>
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
	{#each notes as note (note.id)}
		<div class="card note-list__card">
			<div class="note-list__accent" aria-hidden="true"></div>
			<a href={resolve(`/notes/${note.id}`)} class="note-list__main-link">
				<h2 class="note-list__title">{note.title}</h2>
				<hr class="note-list__divider" />
				{#if hasPreview(note.content)}
					<div class="prose">
						{@html previewHtmlByNoteId[note.id] ?? ''}
					</div>
				{/if}
			</a>
			<div class="note-list__options">
				<button
					type="button"
					class="btn note-list__options-trigger"
					title="Note options"
					aria-haspopup="menu"
					aria-expanded={activeOptionsNoteId === note.id}
					aria-controls={`note-options-${note.id}`}
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						toggleNoteOptions(note.id);
					}}
				>
					<span class="visually-hidden">Open options for {note.title}</span>
					<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
						/>
					</svg>
				</button>
				{#if activeOptionsNoteId === note.id}
					<div
						id={`note-options-${note.id}`}
						class="note-list__options-menu"
						role="menu"
						aria-label={`Actions for ${note.title}`}
					>
						<button
							type="button"
							class="note-list__menu-item"
							role="menuitem"
							disabled={isAppendingNoteId === note.id}
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								appendNote(note.id);
								closeNoteOptions();
							}}
						>
							Append
						</button>
						<button
							type="button"
							class="note-list__menu-item note-list__menu-item--danger"
							role="menuitem"
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								deleteNote(note.id, note.title);
								closeNoteOptions();
							}}
						>
							Delete
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/each}
	{#if isLoadingMore}
		<p class="muted">Loading more notes...</p>
	{/if}
	{#if hasMore && !isLoading}
		<div bind:this={loadMoreSentinel} aria-hidden="true"></div>
	{/if}
{/if}
