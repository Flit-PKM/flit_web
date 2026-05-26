<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CategoryRead } from '$lib/types/note';

	let {
		categories = [],
		availableCategories = [],
		addCategoryId = '',
		isSaving = false,
		onAddCategoryIdChange,
		onAddCategory,
		onRemoveCategory
	}: {
		categories?: CategoryRead[];
		availableCategories?: CategoryRead[];
		addCategoryId?: string;
		isSaving?: boolean;
		onAddCategoryIdChange: (id: string) => void;
		onAddCategory: () => void;
		onRemoveCategory: (id: number) => void;
	} = $props();
</script>

<section class="note-detail__block">
	<h2 class="note-detail__block-title">Categories</h2>
	{#if categories.length > 0}
		<ul class="note-detail__tag-list">
			{#each categories as category (category.id)}
				<li class="note-detail__tag-row">
					<a
						href="{resolve('/notes')}?category={encodeURIComponent(category.name)}"
						class="note-detail__tag-row-main"
					>
						<div class="note-detail__tag-row-inner">
							<span class="note-detail__pill">{category.name}</span>
						</div>
					</a>
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
				</li>
			{/each}
		</ul>
	{:else}
		<p class="card__meta">No categories</p>
	{/if}
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
</section>
