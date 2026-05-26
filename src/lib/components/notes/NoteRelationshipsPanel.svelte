<script lang="ts">
	import { resolve } from '$app/paths';
	import type { NoteDetail, RelationshipRead, RelationshipType } from '$lib/types/note';
	import {
		formatRelationshipType,
		formatRelationshipTypeLabel,
		RELATIONSHIP_TYPES
	} from '$lib/utils/note-detail';
	import { getOtherNoteId } from '$lib/utils/notes';

	let {
		note,
		relationships = [],
		relatedNoteTitles,
		addRelType = 'RELATED_TO' as RelationshipType,
		isSaving = false,
		onAddRelTypeChange,
		onOpenSearch,
		onRemoveRelationship
	}: {
		note: NoteDetail;
		relationships?: RelationshipRead[];
		relatedNoteTitles: Map<number, string>;
		addRelType?: RelationshipType;
		isSaving?: boolean;
		onAddRelTypeChange: (type: RelationshipType) => void;
		onOpenSearch: () => void;
		onRemoveRelationship: (rel: RelationshipRead) => void;
	} = $props();
</script>

<section class="note-detail__block">
	<h2 class="note-detail__block-title">Relationships</h2>
	{#if relationships.length > 0}
		<ul class="note-detail__tag-list">
			{#each relationships as rel (rel.note_a_id + '-' + rel.note_b_id + '-' + rel.type)}
				<li class="note-detail__tag-row">
					<a
						href={resolve(`/notes/${getOtherNoteId(rel, note.id)}`)}
						class="note-detail__tag-row-main"
					>
						<div class="note-detail__tag-row-inner">
							<span class="note-detail__pill">{formatRelationshipTypeLabel(rel, note.id)}</span>
							<span class="note-detail__tag-row-label"
								>{relatedNoteTitles.get(getOtherNoteId(rel, note.id)) ??
									`Note #${getOtherNoteId(rel, note.id)}`}</span
							>
						</div>
					</a>
					<button
						type="button"
						onclick={() => onRemoveRelationship(rel)}
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
		<select
			value={addRelType}
			onchange={(e) => onAddRelTypeChange(e.currentTarget.value as RelationshipType)}
			class="input ch-40"
		>
			{#each RELATIONSHIP_TYPES as t (t)}
				<option value={t}>{formatRelationshipType(t)}</option>
			{/each}
		</select>
		<button type="button" onclick={onOpenSearch} disabled={isSaving} class="btn btn-secondary">
			Select note…
		</button>
	</div>
</section>
