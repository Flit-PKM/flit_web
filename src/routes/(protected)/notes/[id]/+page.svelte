<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/auth';
	import { apiClient, HttpError } from '$lib/api/client';
	import { errorLogger, captureApiError } from '$lib/utils/error-handler';
	import { filterNotDeleted } from '$lib/utils/filter';
	import { markdownToSafeHtml } from '$lib/utils/markdown';
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
	let noteSearchInputEl = $state<HTMLInputElement | null>(null);

	// Markdown-rendered HTML (detail view only, client-side)
	let markdownHtml = $state('');

	// Titles for related notes (id -> title) so we show name instead of "Note #id"
	let relatedNoteTitles = $state(new SvelteMap<number, string>());

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
				noteSearchResults = filterNotDeleted(raw).filter(
					(n) => currentNoteId == null || n.id !== currentNoteId
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
		if (!browser || isEditing || !note) {
			markdownHtml = '';
			return;
		}
		markdownHtml = markdownToSafeHtml(note.content ?? '');
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
			const relatedTitles = new SvelteMap<number, string>();
			const rels = filterNotDeleted(noteData.relationships);
			if (rels.length > 0) {
				const otherIds = [...new Set(rels.map((r) => otherNoteId(r, noteId)))];
				const results = await Promise.allSettled(
					otherIds.map((id) => apiClient.getNote(id).then((n) => ({ id, title: n.title })))
				);
				for (const r of results) {
					if (r.status === 'fulfilled') relatedTitles.set(r.value.id, r.value.title);
				}
			}
			return { data: noteData, error: '', relatedTitles };
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

	// Load note when route param or auth changes; ignore stale responses when navigating quickly
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
				if (
					r.data &&
					(current.url.searchParams.get('edit') === '1' ||
						current.url.searchParams.get('edit') === 'true')
				) {
					startEditing();
					const appendParam = current.url.searchParams.get('append');
					const appendId = appendParam ? Number(appendParam) : NaN;
					if (Number.isInteger(appendId) && appendId !== noteId) {
						try {
							await apiClient.createRelationship({
								note_a_id: appendId,
								note_b_id: noteId,
								type: 'FOLLOWS_ON'
							});
							const refreshed = await loadNote(noteId);
							if (get(page).params.id === String(noteId) && refreshed.data) {
								note = refreshed.data;
								relatedNoteTitles = refreshed.relatedTitles;
							}
						} catch (err) {
							saveError = captureApiError(err, {
								component: 'NoteDetail',
								operation: 'appendRelationship',
								appendFromNoteId: appendId,
								noteId
							});
						}
						goto(resolve(`/notes/${noteId}?edit=1`), { replaceState: true });
					}
				}
			})
			.finally(() => {
				if (get(page).params.id === String(noteId)) isLoading = false;
			});
	});

	onMount(async () => {
		if (!$isAuthenticated) {
			isLoading = false;
			return;
		}
		try {
			const categoriesData = await apiClient.getCategories({ limit: 1000 });
			categories = filterNotDeleted(categoriesData);
		} catch {
			// Non-blocking; note detail can still show
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

	function formatRelationshipTypeLabel(rel: RelationshipRead, currentNoteId: number): string {
		if (rel.type === 'FOLLOWS_ON') {
			return currentNoteId === rel.note_a_id ? 'Follows from' : 'Follows to';
		}
		return formatRelationshipType(rel.type);
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

	async function selectNoteFromSearch(selected: NoteRead) {
		addRelNoteId = String(selected.id);
		addRelNoteTitle = selected.title;
		await addRelationship();
		closeNoteSearchPopup();
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
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'saveNoteFields',
				noteId
			});
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
			const r = await loadNote(note.id);
			if (r.data) {
				note = r.data;
				relatedNoteTitles = r.relatedTitles;
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
			const r = await loadNote(note.id);
			if (r.data) {
				note = r.data;
				relatedNoteTitles = r.relatedTitles;
			}
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
			// Update local note and related titles so the new relationship shows without waiting for refetch
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
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'addRelationship',
				noteId: note.id
			});
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
			const r = await loadNote(note.id);
			if (r.data) {
				note = r.data;
				relatedNoteTitles = r.relatedTitles;
			}
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

	// Filtered note collections (exclude deleted)
	let filteredCategories = $derived(filterNotDeleted(note?.categories));
	let filteredRelationships = $derived(filterNotDeleted(note?.relationships));

	// Categories not already on the note (for Add dropdown)
	let availableCategories = $derived(
		note ? categories.filter((c) => !filteredCategories.some((fc) => fc.id === c.id)) : []
	);
</script>

<svelte:head>
	<title>{note ? `${note.title} – Notes` : 'Note – Flit Web'}</title>
	<meta name="description" content={note ? note.title : 'Note detail'} />
</svelte:head>
<a href={resolve('/notes')} class="link mt-sm">← Back to Notes</a>
<div class="note-page">
	{#if isLoading}
		<div class="card">
			<p class="loading loading--inline-start">
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
				<span>Loading note…</span>
			</p>
		</div>
	{:else if error}
		<div class="note-error">
			<p class="section-title">Could not load note</p>
			<p class="card__meta">{error}</p>
		</div>
	{:else if note}
		<article class={isEditing ? 'note-editor' : 'note-view'}>
			{#if isEditing}
				<header class="note-editor__header">
					<div class="note-editor__header-row">
						<div class="note-editor__header-title-wrap">
							<input
								type="text"
								bind:value={draftTitle}
								class="input note-editor__title-input"
								placeholder="Title"
							/>
						</div>
						<div class="note-editor__actions-row">
							<div class="note-editor__actions">
								<button
									type="button"
									onclick={saveNoteFields}
									disabled={isSaving}
									class="btn btn-primary">Save</button
								>
								<button
									type="button"
									onclick={cancelEditing}
									disabled={isSaving}
									class="btn btn-secondary">Cancel</button
								>
							</div>
							<div class="flex-center">
								<button
									type="button"
									onclick={deleteNote}
									disabled={isSaving}
									class="btn btn-danger">Delete</button
								>
							</div>
						</div>
					</div>
					<div class="note-editor__meta">
						<span>Type: {note.type}</span>
						<span>Updated: {formatDate(note.updated_at)}</span>
						<span>Created: {formatDate(note.created_at)}</span>
					</div>
				</header>
				<div class="note-editor__body">
					<textarea bind:value={draftContent} rows={12} class="input pre-wrap" placeholder="Content"
					></textarea>
				</div>

				<section class="note-editor__block">
					<h2 class="note-editor__block-title">Categories</h2>
					<ul class="note-editor__categories-list">
						{#each filteredCategories as category (category.id)}
							<li class="note-editor__category-item">
								<span class="badge badge--muted">{category.name}</span>
								<button
									type="button"
									onclick={() => removeCategory(category.id)}
									disabled={isSaving}
									class="btn btn-secondary btn--chip"
									title="Remove category"
									aria-label="Remove category"
								>
									×
								</button>
							</li>
						{/each}
					</ul>
					<div class="note-editor__add-row">
						<select
							bind:value={addCategoryId}
							onchange={() => addCategoryId && addCategory()}
							disabled={isSaving}
							class="input ch-40"
						>
							<option value="">Add category…</option>
							{#each availableCategories as cat (cat.id)}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>
				</section>

				<section class="note-editor__block">
					<h2 class="note-editor__block-title">Relationships</h2>
					<ul class="note-editor__rel-list">
						{#each filteredRelationships as rel (rel.note_a_id + '-' + rel.note_b_id + '-' + rel.type)}
							<li class="note-editor__rel-item">
								<div class="note-editor__rel-item-inner">
									<span class="badge badge--primary"
										>{formatRelationshipTypeLabel(rel, note.id)}</span
									>
									<a href={resolve(`/notes/${otherNoteId(rel, note.id)}`)}>
										{relatedNoteTitles.get(otherNoteId(rel, note.id)) ??
											`Note #${otherNoteId(rel, note.id)}`}
									</a>
								</div>
								<button
									type="button"
									onclick={() => removeRelationship(rel)}
									disabled={isSaving}
									class="btn btn-secondary"
								>
									Remove
								</button>
							</li>
						{/each}
					</ul>
					<div class="note-editor__add-row">
						<select bind:value={addRelType} class="input ch-40">
							{#each RELATIONSHIP_TYPES as t (t)}
								<option value={t}>{formatRelationshipType(t)}</option>
							{/each}
						</select>
						<div class="note-editor__actions">
							<button
								type="button"
								onclick={openNoteSearchPopup}
								disabled={isSaving}
								class="btn btn-secondary"
							>
								Select note…
							</button>
						</div>
					</div>
				</section>

				<section class="note-editor__block">
					<div class="note-editor__block-actions">
						<button
							type="button"
							onclick={saveNoteFields}
							disabled={isSaving}
							class="btn btn-primary">Save</button
						>
						<button
							type="button"
							onclick={cancelEditing}
							disabled={isSaving}
							class="btn btn-secondary">Cancel</button
						>
					</div>
				</section>
			{:else}
				<header class="note-view__header">
					<div class="note-view__header-row">
						<div class="note-view__header-title-wrap">
							<h1>{note.title}</h1>
						</div>
						<div class="note-view__actions">
							<button type="button" onclick={startEditing} class="btn btn-secondary">Edit</button>
							<button type="button" onclick={deleteNote} disabled={isSaving} class="btn btn-danger"
								>Delete</button
							>
						</div>
					</div>
					<div class="note-view__meta">
						<span>Type: {note.type}</span>
						<span>Updated: {formatDate(note.updated_at)}</span>
						<span>Created: {formatDate(note.created_at)}</span>
					</div>
				</header>

				<div class="note-view__body">
					{#if markdownHtml}
						<div class="prose">{@html markdownHtml}</div>
					{:else}
						<pre class="pre-wrap">{note.content}</pre>
					{/if}
				</div>

				<section class="note-view__block">
					<h2 class="note-view__block-title">Categories</h2>
					{#if filteredCategories.length > 0}
						<ul class="note-view__categories-list">
							{#each filteredCategories as category (category.id)}
								<li>
									<a
										href={resolve('/notes') + '?category=' + encodeURIComponent(category.name)}
										class="badge badge--muted"
									>
										{category.name}
									</a>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="card__meta">No categories</p>
					{/if}
				</section>

				<section class="note-view__block">
					<h2 class="note-view__block-title">Relationships</h2>
					{#if filteredRelationships.length > 0}
						<ul class="note-view__rel-list">
							{#each filteredRelationships as rel (rel.note_a_id + '-' + rel.note_b_id + '-' + rel.type)}
								<li>
									<a
										href={resolve(`/notes/${otherNoteId(rel, note.id)}`)}
										class="note-view__rel-item"
									>
										<div class="note-view__rel-item-inner">
											<span class="badge badge--primary"
												>{formatRelationshipTypeLabel(rel, note.id)}</span
											>
											<span
												>{relatedNoteTitles.get(otherNoteId(rel, note.id)) ??
													`Note #${otherNoteId(rel, note.id)}`}</span
											>
										</div>
										<svg
											class="icon_sm icon_sm--muted"
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
						<p class="card__meta">No relationships</p>
					{/if}
				</section>
			{/if}
			{#if saveError}
				<p class="form-group__error">{saveError}</p>
			{/if}
		</article>
	{/if}
</div>

<!-- Note search popup (Add relationship) -->
{#if showNoteSearchPopup}
	<div
		class="modal-backdrop modal-backdrop--overlay"
		tabindex="-1"
		onkeydown={handleNoteSearchKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="note-search-title"
		onclick={(e) => e.target === e.currentTarget && closeNoteSearchPopup()}
	>
		<div class="card note-search-dialog" role="document">
			<h2 id="note-search-title" class="section-title--muted">Select note to link</h2>
			<input
				bind:this={noteSearchInputEl}
				type="text"
				bind:value={noteSearchQuery}
				placeholder="Search notes…"
				class="input"
			/>
			<div class="note-search-dialog__scroll">
				{#if noteSearchLoading}
					<p class="card__empty">Loading…</p>
				{:else if noteSearchResults.length === 0}
					<p class="card__empty">
						{noteSearchQuery.trim() ? 'No notes found.' : 'Type to search.'}
					</p>
				{:else}
					<ul class="note-search-dialog__list">
						{#each noteSearchResults as n (n.id)}
							<li>
								<button
									type="button"
									onclick={() => selectNoteFromSearch(n)}
									class="btn btn-secondary w-full flex flex-start text-left"
								>
									<span>{n.title}</span>
									<span class="card__meta">#{n.id}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<div class="note-search-dialog__actions">
				<button type="button" onclick={closeNoteSearchPopup} class="btn btn-secondary">
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
