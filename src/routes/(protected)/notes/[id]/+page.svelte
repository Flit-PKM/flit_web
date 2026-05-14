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
	import { buildRelatedTitleMap, getOtherNoteId } from '$lib/utils/notes';
	import {
		formatNoteDate,
		formatRelationshipType,
		formatRelationshipTypeLabel,
		normalizeNoteContent,
		normalizeNoteTitle,
		RELATIONSHIP_TYPES
	} from '$lib/utils/note-detail';
	import type {
		NoteDetail,
		NoteRead,
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

	const AUTOSAVE_DEBOUNCE_MS = 5000;

	let isLoading = $state(true);
	let note = $state<NoteDetail | null>(null);
	let error = $state('');
	let categories = $state<CategoryRead[]>([]);

	let isAppending = $state(false);
	let liveTitle = $state('');
	let latestContent = $state('');
	let lastSyncedTitle = $state('');
	let lastSyncedContent = $state('');
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
	let noteSearchDebounce: ReturnType<typeof setTimeout> | null = null;
	let noteSearchInputEl = $state<HTMLInputElement | null>(null);

	let showJumpToBottom = $state(false);
	let relatedNoteTitles = $state(new SvelteMap<number, string>());
	let lastHydratedNoteId = $state<number | null>(null);

	let saveToastVisible = $state(false);
	let saveToastTimer: ReturnType<typeof setTimeout> | null = null;

	let saveRequestId = 0;

	function isDirtyAgainstBaseline(): boolean {
		return (
			normalizeNoteTitle(liveTitle) !== normalizeNoteTitle(lastSyncedTitle) ||
			normalizeNoteContent(latestContent) !== normalizeNoteContent(lastSyncedContent)
		);
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
		const title = liveTitle.trim();
		const content = latestContent.trim();
		if (!isDirtyAgainstBaseline()) return;
		if (!title) {
			saveError = 'Title is required.';
			return;
		}
		if (!content) {
			saveError = 'Content is required.';
			return;
		}
		const id = ++saveRequestId;
		saveError = '';
		isSaving = true;
		try {
			errorLogger.logDebug('Autosaving note', { noteId: note.id });
			const updated = await apiClient.updateNote(note.id, { title, content });
			if (id !== saveRequestId) return;
			note = {
				...note,
				title: updated.title,
				content: updated.content,
				type: updated.type,
				pinned: updated.pinned === true,
				version: updated.version,
				updated_at: updated.updated_at
			};
			lastSyncedTitle = updated.title;
			lastSyncedContent = updated.content;
			errorLogger.logDebug('Note autosaved', { noteId: note.id });
			pulseSaveToast();
		} catch (err) {
			if (id === saveRequestId) {
				saveError = captureApiError(err, {
					component: 'NoteDetail',
					operation: 'autosaveNote',
					noteId: note.id
				});
			}
		} finally {
			if (id === saveRequestId) isSaving = false;
		}
	}

	const autosave = debounceTrailing(flushNoteToServer, AUTOSAVE_DEBOUNCE_MS);

	beforeNavigate(async () => {
		await autosave.flush();
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
		const id = note?.id ?? null;
		if (id === null) return;
		if (lastHydratedNoteId !== id) {
			lastHydratedNoteId = id;
			liveTitle = note!.title;
			latestContent = note!.content;
			lastSyncedTitle = note!.title;
			lastSyncedContent = note!.content;
		}
	});

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
				noteSearchResults = filterNotDeleted(raw)
					.filter((n) => currentNoteId == null || n.id !== currentNoteId)
					.map((n) => ({ ...n, pinned: n.pinned === true }));
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
				pinned: noteData.pinned === true
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
				const appendParam = current.url.searchParams.get('append');
				const appendId = appendParam ? Number(appendParam) : NaN;
				if (Number.isInteger(appendId) && appendId !== noteId) {
					try {
						const newRel = await apiClient.createRelationship({
							note_a_id: appendId,
							note_b_id: noteId,
							type: 'FOLLOWS_ON'
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
			autosave.cancel();
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
		updateJumpToBottomVisibility();
		const onScroll = () => updateJumpToBottomVisibility();
		const onResize = () => updateJumpToBottomVisibility();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
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
		updateJumpToBottomVisibility();
	});

	function openNoteSearchPopup() {
		showNoteSearchPopup = true;
		noteSearchQuery = '';
		noteSearchResults = [];
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

	async function appendNoteFromDetail() {
		if (!note || isAppending || isSaving) return;
		isAppending = true;
		saveError = '';
		try {
			errorLogger.logDebug('Appending note from detail', { appendFromNoteId: note.id });
			const created = await apiClient.createNote({ title: 'New note', content: 'Note Content' });
			goto(resolve(`/notes/${created.id}?edit=1&append=${note.id}`));
			errorLogger.logDebug('Append note created successfully from detail', {
				sourceNoteId: note.id,
				newNoteId: created.id
			});
		} catch (err) {
			saveError = captureApiError(err, {
				component: 'NoteDetail',
				operation: 'appendNoteFromDetail',
				sourceNoteId: note.id
			});
		} finally {
			isAppending = false;
		}
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
		if (!confirm('Delete this note? This cannot be undone.')) {
			isSaving = false;
			return;
		}
		saveError = '';
		try {
			await autosave.flush();
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
			await autosave.flush();
			errorLogger.logDebug('Toggling note pin from detail', {
				noteId: note.id,
				nextPinned: !note.pinned
			});
			const updated = await apiClient.updateNote(note.id, { pinned: !note.pinned });
			note = {
				...note,
				pinned: updated.pinned === true,
				version: updated.version,
				updated_at: updated.updated_at
			};
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

	function updateJumpToBottomVisibility() {
		if (!browser || isLoading || !!error || !note) {
			showJumpToBottom = false;
			return;
		}
		const doc = document.documentElement;
		const body = document.body;
		const totalHeight = Math.max(doc.scrollHeight, body.scrollHeight);
		const viewportHeight = window.innerHeight;
		const scrollTop = window.scrollY || doc.scrollTop || 0;
		const isLongContent = totalHeight > viewportHeight + 120;
		const nearBottom = scrollTop + viewportHeight >= totalHeight - 120;
		showJumpToBottom = isLongContent && !nearBottom;
	}

	function jumpToBottom() {
		if (!browser) return;
		window.scrollTo({
			top: document.documentElement.scrollHeight,
			behavior: 'smooth'
		});
	}

	let filteredCategories = $derived(filterNotDeleted(note?.categories));
	let filteredRelationships = $derived(filterNotDeleted(note?.relationships));
	let availableCategories = $derived(
		note ? categories.filter((c) => !filteredCategories.some((fc) => fc.id === c.id)) : []
	);

	let documentTitle = $derived(
		note ? `${liveTitle.trim() || note.title} – Notes` : 'Note – Flit Web'
	);
</script>

<svelte:head>
	<title>{documentTitle}</title>
	<meta name="description" content={note ? liveTitle.trim() || note.title : 'Note detail'} />
</svelte:head>
<div class="note-page">
	<a href={resolve('/notes')} class="mt-sm note-page__back-link">← Back to Notes</a>
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
		<article class="note-detail">
			<header class="note-detail__header">
				<div class="note-detail__header-row">
					<div class="note-detail__header-title-wrap">
						<input
							type="text"
							bind:value={liveTitle}
							class="note-detail__title-input"
							placeholder="Title"
							autocomplete="off"
							oninput={scheduleAutosave}
						/>
					</div>
					<div class="note-detail__actions">
						<button
							type="button"
							onclick={appendNoteFromDetail}
							disabled={isAppending || isSaving}
							class="btn"
						>
							Append
						</button>
						<button
							type="button"
							onclick={() => void toggleNotePinned()}
							disabled={isSaving}
							class="btn"
						>
							{note.pinned ? 'Unpin' : 'Pin'}
						</button>
						<button type="button" onclick={deleteNote} disabled={isSaving} class="btn btn-danger">
							Delete
						</button>
					</div>
				</div>
				<div class="note-detail__meta">
					<span>Type: {note.type}</span>
					<span>Updated: {formatNoteDate(note.updated_at)}</span>
					<span>Created: {formatNoteDate(note.created_at)}</span>
				</div>
			</header>

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

			<section class="note-detail__block">
				<h2 class="note-detail__block-title">Categories</h2>
				{#if filteredCategories.length > 0}
					<ul class="note-detail__tag-list">
						{#each filteredCategories as category (category.id)}
							<li class="note-detail__tag-row">
								<a
									href={resolve('/notes') + '?category=' + encodeURIComponent(category.name)}
									class="note-detail__tag-row-main"
								>
									<div class="note-detail__tag-row-inner">
										<span class="note-detail__pill">{category.name}</span>
									</div>
								</a>
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
				{:else}
					<p class="card__meta">No categories</p>
				{/if}
				<div class="note-detail__add-row">
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

			<section class="note-detail__block">
				<h2 class="note-detail__block-title">Relationships</h2>
				{#if filteredRelationships.length > 0}
					<ul class="note-detail__tag-list">
						{#each filteredRelationships as rel (rel.note_a_id + '-' + rel.note_b_id + '-' + rel.type)}
							<li class="note-detail__tag-row">
								<a
									href={resolve(`/notes/${getOtherNoteId(rel, note.id)}`)}
									class="note-detail__tag-row-main"
								>
									<div class="note-detail__tag-row-inner">
										<span class="note-detail__pill"
											>{formatRelationshipTypeLabel(rel, note.id)}</span
										>
										<span class="note-detail__tag-row-label"
											>{relatedNoteTitles.get(getOtherNoteId(rel, note.id)) ??
												`Note #${getOtherNoteId(rel, note.id)}`}</span
										>
									</div>
								</a>
								<button
									type="button"
									onclick={() => removeRelationship(rel)}
									disabled={isSaving}
									class="btn btn-secondary btn--chip"
									title="Remove relationship"
									aria-label="Remove relationship"
								>
									×
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="card__meta">No relationships</p>
				{/if}
				<div class="note-detail__add-row">
					<select bind:value={addRelType} class="input ch-40">
						{#each RELATIONSHIP_TYPES as t (t)}
							<option value={t}>{formatRelationshipType(t)}</option>
						{/each}
					</select>
					<div class="note-detail__actions">
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

			{#if saveError}
				<p class="form-group__error">{saveError}</p>
			{/if}
		</article>
	{/if}
</div>

{#if browser && saveToastVisible}
	<div class="note-save-toast" role="status" aria-live="polite">...updated</div>
{/if}

{#if showJumpToBottom}
	<button
		type="button"
		onclick={jumpToBottom}
		class="btn note-page__jump-bottom"
		aria-label="Jump to bottom"
		title="Jump to bottom"
	>
		Bottom
	</button>
{/if}

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
