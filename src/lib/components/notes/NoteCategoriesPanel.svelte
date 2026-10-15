<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CategoryRead } from '$lib/types/note';

	let {
		categories = [],
		availableCategories = [],
		addCategoryId = '',
		isSaving = false,
		editing = false,
		onAddCategoryIdChange,
		onAddCategory,
		onRemoveCategory
	}: {
		categories?: CategoryRead[];
		availableCategories?: CategoryRead[];
		addCategoryId?: string;
		isSaving?: boolean;
		editing?: boolean;
		onAddCategoryIdChange: (id: string) => void;
		onAddCategory: () => void;
		onRemoveCategory: (id: number) => void;
	} = $props();
</script>

<section class="note-detail__block" class:note-detail__block--editing={editing}>
	{#if editing}
		<h2 class="note-detail__block-title">Categories</h2>
	{/if}
	{#if categories.length > 0}
		<ul class="note-detail__tag-list">
			{#each categories as category (category.id)}
				<li class="note-detail__tag-row">
					<a
						href="{resolve('/notes')}?category={encodeURIComponent(category.name)}"
						class="note-detail__tag-row-main"
					>
						<span class="note-detail__pill">{category.name}</span>
					</a>
					{#if editing}
						<button
							type="button"
							onclick={() => onRemoveCategory(category.id)}
							disabled={isSaving}
							class="btn btn-secondary btn--chip"
							title="Remove category"
							aria-label="Remove category"
						>
							×
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{#if editing}
		<div class="note-detail__add-row">
			<select
				value={addCategoryId}
				onchange={(e) => {
					const id = e.currentTarget.value;
					onAddCategoryIdChange(id);
					if (id) onAddCategory();
				}}
				disabled={isSaving}
				class="input ch-40"
			>
				<option value="">Add category…</option>
				{#each availableCategories as cat (cat.id)}
					<option value={String(cat.id)}>{cat.name}</option>
				{/each}
			</select>
		</div>
	{/if}
</section>
