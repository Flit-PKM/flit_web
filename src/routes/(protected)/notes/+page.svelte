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
	<meta name="description" content="Your notes, sorted by last updated." />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<h1 class="text-2xl font-bold text-flit-ink sm:text-3xl">Notes</h1>

	<!-- Search and Filter Controls -->
	<div class="card mt-6 p-4">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
			<!-- Search Input -->
			<div class="relative flex-1">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					<svg
						class="h-5 w-5 text-flit-muted"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>
				<input
					type="text"
					placeholder="Search notes..."
					value={searchQuery}
					oninput={handleSearchInput}
					class="input py-2 pr-4 pl-10 backdrop-blur-sm transition-colors"
				/>
			</div>

			<!-- Category Filter -->
			<div class="flex flex-wrap items-center gap-2">
				<label for="category-filter" class="text-sm font-medium whitespace-nowrap text-flit-muted">
					Category:
				</label>
				<select
					id="category-filter"
					value={selectedCategory}
					onchange={handleCategoryChange}
					class="input w-auto min-w-0 backdrop-blur-sm transition-colors"
				>
					<option value="">All categories</option>
					{#each categories as category (category.id)}
						<option value={category.name}>{category.name}</option>
					{/each}
				</select>
				<div class="flex min-w-0 flex-1 justify-end gap-2">
					<button
						type="button"
						onclick={openCreateCategory}
						disabled={isCategoryBusy}
						class="btn btn-secondary"
						title="Create category"
					>
						+
					</button>
					<button
						type="button"
						onclick={deleteSelectedCategory}
						disabled={selectedCategoryId === undefined || isCategoryBusy}
						class="btn btn-secondary"
						title="Delete selected category"
					>
						-
					</button>
				</div>
			</div>

			<!-- Clear Filters Button -->
			{#if hasActiveFilters}
				<button type="button" onclick={clearFilters} class="btn btn-secondary">
					<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
					Clear
				</button>
			{/if}
		</div>

		<!-- Create category inline -->
		{#if showCreateCategory}
			<div class="mt-3 flex flex-wrap items-center gap-2">
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
					class="btn btn-primary"
				>
					Create
				</button>
				<button
					type="button"
					onclick={cancelCreateCategory}
					disabled={isCategoryBusy}
					class="btn btn-secondary"
				>
					Cancel
				</button>
				{#if categoryError}
					<span class="text-sm text-flit-negative">{categoryError}</span>
				{/if}
			</div>
		{/if}

		<!-- Active filters indicator -->
		{#if hasActiveFilters}
			<div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-flit-muted">
				<span>Filtering by:</span>
				{#if searchQuery}
					<span
						class="inline-flex items-center rounded-full bg-flit-primary/20 px-2.5 py-0.5 text-xs font-medium text-flit-primary"
					>
						Search: "{searchQuery}"
					</span>
				{/if}
				{#if selectedCategory}
					<span
						class="inline-flex items-center rounded-full bg-flit-primary/20 px-2.5 py-0.5 text-xs font-medium text-flit-primary"
					>
						Category: {selectedCategory}
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- +New Note -->
	<div class="mt-4">
		<button
			type="button"
			onclick={createNewNote}
			disabled={isCreatingNote}
			class="btn btn-primary px-4"
		>
			+ New Note
		</button>
	</div>

	<!-- Notes List -->
	{#if isLoading}
		<div class="mt-6 flex items-center justify-center py-8">
			<svg
				class="h-8 w-8 animate-spin text-flit-primary"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<span class="ml-2 text-flit-muted">Loading notes...</span>
		</div>
	{:else if error}
		<div
			class="mt-6 rounded-lg border border-flit-negative/30 bg-flit-card p-4 text-flit-ink shadow-flit-sm"
		>
			<p class="font-medium">Could not load notes</p>
			<p class="mt-1 text-sm text-flit-muted">{error}</p>
		</div>
	{:else if notes.length === 0}
		<div class="mt-6 py-8 text-center">
			{#if hasActiveFilters}
				<svg
					class="mx-auto h-12 w-12 text-flit-muted"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="mt-2 text-flit-muted">No notes match your filters.</p>
				<button type="button" onclick={clearFilters} class="btn btn-primary mt-4 px-4">
					Clear filters
				</button>
			{:else}
				<p class="text-flit-muted">No notes yet.</p>
			{/if}
		</div>
	{:else}
		<p class="mt-4 text-sm text-flit-muted">
			{notes.length} note{notes.length === 1 ? '' : 's'} found
		</p>
		<ul class="mt-4 space-y-8">
			{#each notes as note (note.id)}
				<li class="relative">
					<a
						href={resolve(`/notes/${note.id}`)}
						class="block rounded-xl border border-flit-muted/20 bg-flit-card p-4 pb-14 shadow-flit-sm transition-colors hover:border-flit-muted/40 hover:bg-flit-muted/5 focus:ring-2 focus:ring-flit-primary focus:ring-offset-2 focus:ring-offset-flit-canvas focus:outline-none"
					>
						<h2 class="text-center font-semibold text-flit-ink">{note.title}</h2>
						<hr class="my-2 border-flit-muted/20" />
						{#if hasPreview(note.content)}
							<div class="prose prose-sm mt-2 line-clamp-3 max-w-none text-flit-muted prose-flit">
								{@html previewHtmlByNoteId[note.id] ?? ''}
							</div>
						{/if}
					</a>
					<div
						class="absolute right-0 bottom-0 left-0 z-10 mr-[2ch] flex translate-y-1/2 flex-row justify-end gap-2"
						role="group"
						aria-label="Note actions"
					>
						<button
							type="button"
							title="Append note"
							disabled={isAppendingNoteId === note.id}
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								appendNote(note.id);
							}}
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-flit-canvas bg-flit-card-opaque shadow-flit-sm transition-colors hover:border-flit-primary/50 hover:bg-flit-muted/10 focus:ring-2 focus:ring-flit-primary focus:ring-offset-2 focus:ring-offset-flit-canvas focus:outline-none disabled:opacity-50"
						>
							<svg
								class="h-5 w-5 text-flit-ink"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
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
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-flit-canvas bg-flit-card-opaque shadow-flit-sm transition-colors hover:border-flit-primary/50 hover:bg-flit-muted/10 focus:ring-2 focus:ring-flit-primary focus:ring-offset-2 focus:ring-offset-flit-canvas focus:outline-none"
						>
							<svg
								class="h-5 w-5 text-flit-ink"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
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
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-flit-canvas bg-flit-card-opaque shadow-flit-sm transition-colors hover:border-flit-negative/50 hover:bg-flit-negative/10 focus:ring-2 focus:ring-flit-primary focus:ring-offset-2 focus:ring-offset-flit-canvas focus:outline-none"
						>
							<svg
								class="h-5 w-5 text-flit-ink"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
