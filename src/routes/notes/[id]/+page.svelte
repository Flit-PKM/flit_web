<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient, HttpError } from '$lib/api/client';
	import { errorLogger, handleApiError, formatErrorForUser } from '$lib/utils/error-handler';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import type {
		NoteDetail,
		NoteRead,
		RelationshipRead,
		CategoryRead,
		RelationshipType
	} from '$lib/types/note';

	const RELATIONSHIP_TYPES: RelationshipType[] = [
		'RELATED_TO',
		'FOLLOWS_ON',
		'SIMILAR_TO',
		'CONTRADICTS',
		'REFERENCES'
	];

	let isLoading = $state(true);
	let note = $state<NoteDetail | null>(null);
	let error = $state('');
	let categories = $state<CategoryRead[]>([]);

	// Edit mode
	let isEditing = $state(false);
	let draftTitle = $state('');
	let draftContent = $state('');
	let saveError = $state('');
	let isSaving = $state(false);
	let addCategoryId = $state('');
	let addRelNoteId = $state('');
	let addRelNoteTitle = $state('');
	let addRelType = $state<RelationshipType>('RELATED_TO');

	// Note search popup (Add relationship)
	let showNoteSearchPopup = $state(false);
	let noteSearchQuery = $state('');
	let noteSearchResults = $state<NoteRead[]>([]);
	let noteSearchLoading = $state(false);
	let noteSearchDebounce: ReturnType<typeof setTimeout> | null = null;
	let noteSearchInputEl: HTMLInputElement | null = null;

	// Markdown-rendered HTML (detail view only, client-side)
	let markdownHtml = $state('');

	// Redirect if not authenticated (immediate check)
	$effect(() => {
		if (!$isAuthenticated) {
			goto(resolve('/login'));
		}
	});

	// Debounced note search when popup is open
	$effect(() => {
		if (!showNoteSearchPopup) return;
		const q = noteSearchQuery;
		const currentNoteId = note?.id;
		if (noteSearchDebounce) clearTimeout(noteSearchDebounce);
		noteSearchDebounce = setTimeout(async () => {
			noteSearchLoading = true;
			try {
				const raw = await apiClient.getNotes(
					q.trim() ? { search: q.trim(), limit: 50 } : { limit: 20 }
				);
				noteSearchResults = raw.filter(
					(n) => !n.is_deleted && (currentNoteId == null || n.id !== currentNoteId)
				);
			} catch {
				noteSearchResults = [];
			} finally {
				noteSearchLoading = false;
			}
			noteSearchDebounce = null;
		}, 300);
		return () => {
			if (noteSearchDebounce) clearTimeout(noteSearchDebounce);
		};
	});

	// Parse markdown to HTML when viewing (not editing)
	$effect(() => {
		if (!browser) return;
		if (isEditing || !note) {
			markdownHtml = '';
			return;
		}
		void parseMarkdownContent();
	});

	async function parseMarkdownContent() {
		if (!note || isEditing) {
			markdownHtml = '';
			return;
		}

		const raw = note.content ?? '';
		if (!raw.trim()) {
			markdownHtml = '';
			return;
		}

		try {
			errorLogger.logDebug('Parsing markdown content', { noteId: note.id });
			const parsed = await marked.parse(raw);
			markdownHtml = DOMPurify.sanitize(parsed);
			errorLogger.logDebug('Markdown parsed successfully', { noteId: note.id });
		} catch (err) {
			errorLogger.logError(err instanceof Error ? err : new Error(String(err)), {
				component: 'NoteDetail',
				operation: 'markdownParse',
				noteId: note.id
			});
			// If markdown parsing fails, fall back to raw content
			markdownHtml = '';
		}
	}

	async function loadNote(noteId: number) {
		try {
			note = await apiClient.getNote(noteId);
			error = '';
		} catch (err) {
			if (err instanceof HttpError && err.status === 404) {
				error = 'Note not found.';
			} else {
				error = err instanceof HttpError ? err.message : 'Failed to load note. Please try again.';
			}
			note = null;
		}
	}

	onMount(async () => {
		if (!$isAuthenticated) {
			isLoading = false;
			return;
		}
		const id = $page.params.id;
		const noteId = Number(id);
		if (!Number.isInteger(noteId) || noteId < 1) {
			error = 'Invalid note.';
			isLoading = false;
			return;
		}
		isLoading = true;
		try {
			const [noteData, categoriesData] = await Promise.all([
				apiClient.getNote(noteId),
				apiClient.getCategories({ limit: 1000 })
			]);
			note = noteData;
			categories = categoriesData.filter((c) => !c.is_deleted);
			error = '';
			const editParam = $page.url.searchParams.get('edit');
			if (editParam === '1' || editParam === 'true') {
				startEditing();
			}
		} catch (err) {
			if (err instanceof HttpError && err.status === 404) {
				error = 'Note not found.';
			} else {
				error = err instanceof HttpError ? err.message : 'Failed to load note. Please try again.';
			}
			note = null;
		} finally {
			isLoading = false;
		}
	});

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleString();
		} catch {
			return iso;
		}
	}

	function otherNoteId(rel: RelationshipRead, currentId: number): number {
		return rel.note_a_id === currentId ? rel.note_b_id : rel.note_a_id;
	}

	function formatRelationshipType(type: string): string {
		return type
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function startEditing() {
		if (!note) return;
		isEditing = true;
		draftTitle = note.title;
		draftContent = note.content;
		saveError = '';
		addCategoryId = '';
		addRelNoteId = '';
		addRelNoteTitle = '';
		addRelType = 'RELATED_TO';
	}

	function openNoteSearchPopup() {
		showNoteSearchPopup = true;
		noteSearchQuery = '';
		noteSearchResults = [];
		// Focus search input after panel is in DOM
		setTimeout(() => noteSearchInputEl?.focus(), 0);
	}

	function closeNoteSearchPopup() {
		showNoteSearchPopup = false;
		noteSearchQuery = '';
		noteSearchResults = [];
	}

	function selectNoteFromSearch(selected: NoteRead) {
		addRelNoteId = String(selected.id);
		addRelNoteTitle = selected.title;
		closeNoteSearchPopup();
	}

	function clearRelNoteSelection() {
		addRelNoteId = '';
		addRelNoteTitle = '';
	}

	function handleNoteSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeNoteSearchPopup();
	}

	function cancelEditing() {
		isEditing = false;
		draftTitle = '';
		draftContent = '';
		saveError = '';
	}

	async function saveNoteFields() {
		if (!note) return;
		const title = draftTitle.trim();
		const content = draftContent.trim();

		// Validate inputs before attempting save
		if (!title) {
			saveError = 'Title is required.';
			return;
		}
		if (!content) {
			saveError = 'Content is required.';
			return;
		}

		isSaving = true;
		saveError = '';

		const noteId = note.id;
		try {
			errorLogger.logDebug('Saving note', { noteId, action: 'saveNoteFields' });
			await apiClient.updateNote(noteId, { title, content });
			errorLogger.logDebug('Note saved successfully', { noteId });
		} catch (err) {
			const handledError = handleApiError(err, {
				component: 'NoteDetail',
				operation: 'saveNoteFields',
				noteId
			});
			saveError = formatErrorForUser(handledError);
			errorLogger.logError(handledError, { noteId });
			return;
		} finally {
			isSaving = false;
		}
		await new Promise((res) => setTimeout(res, 100));
		window.location.replace(resolve(`/notes/${noteId}`));
	}

	async function addCategory() {
		if (!note || !addCategoryId) return;
		const categoryId = Number(addCategoryId);
		if (!Number.isInteger(categoryId)) return;
		isSaving = true;
		saveError = '';
		try {
			await apiClient.addCategoryToNote(note.id, categoryId);
			await loadNote(note.id);
			addCategoryId = '';
		} catch (err) {
			saveError = err instanceof HttpError ? err.message : 'Failed to add category.';
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
			await loadNote(note.id);
			errorLogger.logDebug('Category removed successfully', { noteId: note.id, categoryId });
		} catch (err) {
			const handledError = handleApiError(err, {
				component: 'NoteDetail',
				operation: 'removeCategory',
				noteId: note.id,
				categoryId
			});
			saveError = formatErrorForUser(handledError);
			errorLogger.logError(handledError, { noteId: note.id, categoryId });
		} finally {
			isSaving = false;
		}
	}

	async function addRelationship() {
		if (!note) return;
		const otherId = Number(addRelNoteId);
		if (!Number.isInteger(otherId) || otherId === note.id) {
			saveError = 'Enter a valid different note ID.';
			return;
		}
		isSaving = true;
		saveError = '';
		try {
			const newRel = await apiClient.createRelationship({
				note_a_id: note.id,
				note_b_id: otherId,
				type: addRelType
			});
			// Update local note immediately so the new relationship shows without waiting for refetch
			const existing = (note.relationships ?? []).filter((r) => !r.is_deleted);
			note = {
				...note,
				relationships: [...existing, newRel]
			};
			addRelNoteId = '';
			addRelNoteTitle = '';
			addRelType = 'RELATED_TO';
		} catch (err) {
			saveError = err instanceof HttpError ? err.message : 'Failed to add relationship.';
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
			await loadNote(note.id);
			errorLogger.logDebug('Relationship removed successfully', { noteId: note.id });
		} catch (err) {
			const handledError = handleApiError(err, {
				component: 'NoteDetail',
				operation: 'removeRelationship',
				noteId: note.id,
				relId: `${rel.note_a_id}-${rel.note_b_id}-${rel.type}`
			});
			saveError = formatErrorForUser(handledError);
			errorLogger.logError(handledError, { noteId: note.id });
		} finally {
			isSaving = false;
		}
	}

	async function deleteNote() {
		if (!note) return;
		if (isSaving) return;
		isSaving = true;
		if (!confirm('Delete this note? This cannot be undone.')) {
			isSaving = false;
			return;
		}
		saveError = '';
		try {
			await apiClient.deleteNote(note.id);
			await goto(resolve('/notes'));
		} catch (err) {
			saveError = err instanceof HttpError ? err.message : 'Failed to delete note.';
		} finally {
			isSaving = false;
		}
	}

	// Categories not already on the note (for Add dropdown)
	let availableCategories = $derived(
		note
			? categories.filter((c) => !note!.categories?.some((nc) => !nc.is_deleted && nc.id === c.id))
			: []
	);
</script>

<svelte:head>
	<title>{note ? `${note.title} – Notes` : 'Note – Flit Web'}</title>
	<meta name="description" content={note ? note.title : 'Note detail'} />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<a
		href={resolve('/notes')}
		class="inline-flex items-center text-sm font-medium text-flit-link transition-colors hover:text-flit-ink focus:ring-2 focus:ring-flit-primary focus:ring-offset-2 focus:ring-offset-flit-canvas focus:outline-none"
	>
		← Back to Notes
	</a>

	{#if isLoading}
		<p class="mt-6 text-flit-muted">Loading note…</p>
	{:else if error}
		<div
			class="mt-6 rounded-lg border border-flit-negative/30 bg-flit-card p-4 text-flit-ink shadow-flit-sm"
		>
			<p class="font-medium">Could not load note</p>
			<p class="mt-1 text-sm text-flit-muted">{error}</p>
		</div>
	{:else if note}
		<article class="card mt-6">
			<header class="border-b border-flit-muted/20 pb-4">
				<div class="flex flex-wrap items-start justify-between gap-2">
					{#if isEditing}
						<div class="min-w-0 flex-1">
							<input
								type="text"
								bind:value={draftTitle}
								class="input text-2xl font-bold sm:text-3xl"
								placeholder="Title"
							/>
						</div>
						<div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={saveNoteFields}
									disabled={isSaving}
									class="btn btn-primary"
								>
									Save
								</button>
								<button
									type="button"
									onclick={cancelEditing}
									disabled={isSaving}
									class="btn btn-secondary"
								>
									Cancel
								</button>
							</div>
							<div class="mt-3 flex justify-center">
								<button
									type="button"
									onclick={deleteNote}
									disabled={isSaving}
									class="btn btn-danger"
								>
									Delete
								</button>
							</div>
						</div>
					{:else}
						<h1 class="text-2xl font-bold text-flit-ink sm:text-3xl">{note.title}</h1>
						<div class="flex items-center gap-2">
							<button type="button" onclick={startEditing} class="btn btn-secondary"> Edit </button>
							<button type="button" onclick={deleteNote} disabled={isSaving} class="btn btn-danger">
								Delete
							</button>
						</div>
					{/if}
				</div>
				{#if isEditing}{/if}
				<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-flit-muted">
					<span>Type: {note.type}</span>
					<span>Updated: {formatDate(note.updated_at)}</span>
					<span>Created: {formatDate(note.created_at)}</span>
				</div>
			</header>
			<div class="mt-4">
				{#if isEditing}
					<textarea
						bind:value={draftContent}
						rows={12}
						class="input font-sans whitespace-pre-wrap"
						placeholder="Content"
					></textarea>
				{:else if markdownHtml}
					<div class="prose max-w-none prose-flit">{@html markdownHtml}</div>
				{:else}
					<pre class="font-sans whitespace-pre-wrap text-flit-ink">{note.content}</pre>
				{/if}
			</div>
			{#if saveError}
				<p class="mt-2 text-sm text-flit-negative">{saveError}</p>
			{/if}

			<section class="mt-6 border-t border-flit-muted/20 pt-4">
				<h2 class="text-sm font-semibold tracking-wide text-flit-muted uppercase">Categories</h2>
				{#if isEditing}
					<ul class="mt-2 flex flex-wrap gap-2">
						{#each note.categories?.filter((c) => !c.is_deleted) ?? [] as category (category.id)}
							<li
								class="inline-flex items-center gap-1 rounded-md bg-flit-muted/20 px-2 py-1 text-sm text-flit-ink"
							>
								<span>{category.name}</span>
								<button
									type="button"
									onclick={() => removeCategory(category.id)}
									disabled={isSaving}
									class="rounded p-0.5 text-flit-muted hover:bg-flit-negative/20 hover:text-flit-negative focus:ring-2 focus:ring-flit-primary focus:outline-none disabled:opacity-50"
									title="Remove category"
									aria-label="Remove category"
								>
									×
								</button>
							</li>
						{/each}
					</ul>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<select bind:value={addCategoryId} class="input w-auto min-w-0 text-sm">
							<option value="">Add category…</option>
							{#each availableCategories as cat (cat.id)}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
						<button
							type="button"
							onclick={addCategory}
							disabled={isSaving || !addCategoryId}
							class="btn btn-secondary"
						>
							Add
						</button>
					</div>
				{:else if note.categories && note.categories.filter((c) => !c.is_deleted).length > 0}
					<ul class="mt-2 flex flex-wrap gap-2">
						{#each note.categories.filter((c) => !c.is_deleted) as category (category.id)}
							<li>
								<span
									class="inline-flex rounded-md bg-flit-muted/20 px-2 py-1 text-sm text-flit-ink"
								>
									{category.name}
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-2 text-sm text-flit-muted">No categories</p>
				{/if}
			</section>

			<section class="mt-6 border-t border-flit-muted/20 pt-4">
				<h2 class="text-sm font-semibold tracking-wide text-flit-muted uppercase">Relationships</h2>
				{#if isEditing}
					<ul class="mt-2 space-y-2">
						{#each note.relationships?.filter((r) => !r.is_deleted) ?? [] as rel (rel.note_a_id + '-' + rel.note_b_id + '-' + rel.type)}
							<li
								class="flex items-center justify-between gap-2 rounded-lg border border-flit-muted/30 bg-flit-canvas/50 px-4 py-3 shadow-flit-sm"
							>
								<div class="flex items-center gap-3">
									<span
										class="inline-flex rounded-md bg-flit-primary/20 px-2 py-1 text-xs font-medium text-flit-primary"
									>
										{formatRelationshipType(rel.type)}
									</span>
									<a
										href={resolve(`/notes/${otherNoteId(rel, note.id)}`)}
										class="text-sm text-flit-link hover:underline"
									>
										Note #{otherNoteId(rel, note.id)}
									</a>
								</div>
								<button
									type="button"
									onclick={() => removeRelationship(rel)}
									disabled={isSaving}
									class="rounded px-2 py-1 text-sm font-medium text-flit-muted hover:bg-flit-negative/20 hover:text-flit-negative focus:ring-2 focus:ring-flit-primary focus:outline-none disabled:opacity-50"
								>
									Remove
								</button>
							</li>
						{/each}
					</ul>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#if addRelNoteId}
							<span
								class="inline-flex items-center gap-2 rounded-lg border border-flit-muted/30 bg-flit-canvas/50 px-3 py-2 text-sm text-flit-ink"
							>
								Note #{addRelNoteId}: {addRelNoteTitle || '…'}
								<button
									type="button"
									onclick={openNoteSearchPopup}
									class="rounded px-1.5 py-0.5 text-flit-link hover:bg-flit-muted/20 focus:ring-2 focus:ring-flit-primary focus:outline-none"
								>
									Change
								</button>
								<button
									type="button"
									onclick={clearRelNoteSelection}
									class="rounded px-1.5 py-0.5 text-flit-muted hover:bg-flit-negative/20 hover:text-flit-negative focus:ring-2 focus:ring-flit-primary focus:outline-none"
								>
									Clear
								</button>
							</span>
						{:else}
							<button type="button" onclick={openNoteSearchPopup} class="btn btn-secondary">
								Select note…
							</button>
						{/if}
						<select bind:value={addRelType} class="input w-auto min-w-0 text-sm">
							{#each RELATIONSHIP_TYPES as t}
								<option value={t}>{formatRelationshipType(t)}</option>
							{/each}
						</select>
						<button
							type="button"
							onclick={addRelationship}
							disabled={isSaving || !addRelNoteId.trim()}
							class="btn btn-secondary"
						>
							Add
						</button>
					</div>
				{:else if note.relationships && note.relationships.filter((r) => !r.is_deleted).length > 0}
					<ul class="mt-2 space-y-2">
						{#each note.relationships.filter((r) => !r.is_deleted) as rel (rel.note_a_id + '-' + rel.note_b_id + '-' + rel.type)}
							<li>
								<a
									href={resolve(`/notes/${otherNoteId(rel, note.id)}`)}
									class="flex items-center justify-between rounded-lg border border-flit-muted/30 bg-flit-canvas/50 px-4 py-3 shadow-flit-sm backdrop-blur-sm transition-all hover:border-flit-primary/50 hover:bg-flit-muted/5 hover:shadow-md focus:ring-2 focus:ring-flit-primary focus:ring-offset-2 focus:ring-offset-flit-canvas focus:outline-none"
								>
									<div class="flex items-center gap-3">
										<span
											class="inline-flex rounded-md bg-flit-primary/20 px-2 py-1 text-xs font-medium text-flit-primary"
										>
											{formatRelationshipType(rel.type)}
										</span>
										<span class="text-sm text-flit-ink">Note #{otherNoteId(rel, note.id)}</span>
									</div>
									<svg
										class="h-5 w-5 text-flit-muted transition-transform group-hover:translate-x-1"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 5l7 7-7 7"
										/>
									</svg>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-2 text-sm text-flit-muted">No relationships</p>
				{/if}
			</section>
		</article>
	{/if}

	<!-- Note search popup (Add relationship) -->
	{#if showNoteSearchPopup}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onkeydown={handleNoteSearchKeydown}
			role="dialog"
			aria-modal="true"
			aria-labelledby="note-search-title"
			onclick={() => closeNoteSearchPopup()}
		>
			<div
				class="w-full max-w-md rounded-xl border border-flit-muted/20 bg-flit-card p-4 shadow-flit-sm"
				onclick={(e) => e.stopPropagation()}
				role="document"
			>
				<h2
					id="note-search-title"
					class="text-sm font-semibold tracking-wide text-flit-muted uppercase"
				>
					Select note to link
				</h2>
				<input
					bind:this={noteSearchInputEl}
					type="text"
					bind:value={noteSearchQuery}
					placeholder="Search notes…"
					class="input mt-2 text-sm"
				/>
				<div class="mt-2 max-h-64 overflow-y-auto rounded-lg border border-flit-muted/20">
					{#if noteSearchLoading}
						<p class="py-4 text-center text-sm text-flit-muted">Loading…</p>
					{:else if noteSearchResults.length === 0}
						<p class="py-4 text-center text-sm text-flit-muted">
							{noteSearchQuery.trim() ? 'No notes found.' : 'Type to search.'}
						</p>
					{:else}
						<ul class="divide-y divide-flit-muted/20">
							{#each noteSearchResults as n (n.id)}
								<li>
									<button
										type="button"
										onclick={() => selectNoteFromSearch(n)}
										class="w-full px-3 py-2 text-left text-sm text-flit-ink hover:bg-flit-muted/10 focus:bg-flit-muted/10 focus:ring-2 focus:ring-flit-primary focus:outline-none focus:ring-inset"
									>
										<span class="font-medium">{n.title}</span>
										<span class="ml-2 text-flit-muted">#{n.id}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				<div class="mt-3 flex justify-end">
					<button type="button" onclick={closeNoteSearchPopup} class="btn btn-secondary">
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
