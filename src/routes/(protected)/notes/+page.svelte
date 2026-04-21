<script lang="ts">
	import { onMount } from 'svelte';
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
			m[n.id] = markdownToSafeHtml(n.content ?? '', { maxLines: 3 });
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

	// Fetch notes with current filters
	async function fetchNotes() {
		if (!$isAuthenticated) return;

		isLoading = true;
		error = '';

		try {
			errorLogger.logDebug('Loading notes', { search: searchQuery, filter: selectedCategory });
			const raw = await apiClient.getNotes({
				limit: 1000,
				search: searchQuery || undefined,
				filter: selectedCategory || undefined
			});
			const filtered = filterNotDeleted(raw);
			notes = filtered.sort(
				(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
			);
			errorLogger.logDebug('Notes loaded successfully', { count: notes.length });
		} catch (err) {
			error = captureApiError(err, {
				component: 'NotesList',
				operation: 'loadNotes',
				search: searchQuery,
				filter: selectedCategory
			});
		} finally {
			isLoading = false;
		}
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
			fetchNotes();
		}, 1000);
	}

	// Category filter handler
	function handleCategoryChange(event: Event) {
		selectedCategory = (event.target as HTMLSelectElement).value;
		fetchNotes();
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedCategory = '';
		fetchNotes();
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
			await fetchNotes();
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
			await new Promise((resolve) => setTimeout(resolve, 100));
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
			await new Promise((r) => setTimeout(r, 100));
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

	function navigateToEdit(noteId: number) {
		goto(resolve(`/notes/${noteId}?edit=1`));
	}

	async function deleteNote(noteId: number, noteTitle: string) {
		if (!$isAuthenticated) return;
		if (!confirm(`Delete note "${noteTitle}"? This cannot be undone.`)) return;
		error = '';
		try {
			errorLogger.logDebug('Deleting note', { noteId });
			await apiClient.deleteNote(noteId);
			notes = notes.filter((n) => n.id !== noteId);
			errorLogger.logDebug('Note deleted successfully', { noteId });
		} catch (err) {
			error = captureApiError(err, {
				component: 'NotesList',
				operation: 'deleteNote',
				noteId
			});
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
		await fetchNotes();
	});
</script>

<svelte:head>
	<title>Notes – Flit Web</title>
</svelte:head>

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
		{notes.length} note{notes.length === 1 ? '' : 's'} found
	</p>
	{#each notes as note (note.id)}
		<div class="card">
			<a href={resolve(`/notes/${note.id}`)}>
				<h2>{note.title}</h2>
				<hr />
				{#if hasPreview(note.content)}
					<div class="prose">
						{@html previewHtmlByNoteId[note.id] ?? ''}
					</div>
				{/if}
			</a>
			<div class="card__actions" role="group" aria-label="Note actions">
				<button
					type="button"
					title="Append note"
					disabled={isAppendingNoteId === note.id}
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						appendNote(note.id);
					}}
					class="btn"
				>
					<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
				</button>
				<button
					type="button"
					title="Edit note"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						navigateToEdit(note.id);
					}}
					class="btn"
				>
					<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
				</button>
				<button
					type="button"
					title="Delete note"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						deleteNote(note.id, note.title);
					}}
					class="btn btn-danger"
				>
					<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/each}
{/if}
