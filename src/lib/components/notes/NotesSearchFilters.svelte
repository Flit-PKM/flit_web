<script lang="ts">
	import type { CategoryRead } from '$lib/types/note';

	let {
		searchQuery = '',
		selectedCategory = '',
		categories = [],
		hasActiveFilters = false,
		isCategoryBusy = false,
		isCreatingNote = false,
		showCategoryTools = false,
		selectedCategoryId,
		onSearchInput,
		onCategoryChange,
		onClearFilters,
		onToggleCategories,
		onCreateNote,
		onDeleteSelectedCategory
	}: {
		searchQuery?: string;
		selectedCategory?: string;
		categories?: CategoryRead[];
		hasActiveFilters?: boolean;
		isCategoryBusy?: boolean;
		isCreatingNote?: boolean;
		showCategoryTools?: boolean;
		selectedCategoryId?: number;
		onSearchInput: (event: Event) => void;
		onCategoryChange: (event: Event) => void;
		onClearFilters: () => void;
		onToggleCategories: () => void;
		onCreateNote: () => void;
		onDeleteSelectedCategory: () => void;
	} = $props();
</script>

<div class="notes-toolbar">
	<div class="notes-toolbar__row">
		<div class="notes-toolbar__search">
			<label class="visually-hidden" for="notes-search">Search notes</label>
			<input
				id="notes-search"
				type="text"
				placeholder="Search notes…"
				value={searchQuery}
				oninput={onSearchInput}
				class="input wide"
			/>
		</div>
		<div class="notes-toolbar__category">
			<label class="visually-hidden" for="category-filter">Category</label>
			<select
				id="category-filter"
				value={selectedCategory}
				onchange={onCategoryChange}
				class="input wide"
			>
				<option value="">All categories</option>
				{#each categories as category (category.id)}
					<option value={category.name}>{category.name}</option>
				{/each}
			</select>
		</div>
		<button type="button" onclick={onCreateNote} disabled={isCreatingNote} class="btn btn-primary">
			New note
		</button>
		<button
			type="button"
			class="notes-toolbar__text"
			aria-expanded={showCategoryTools}
			onclick={onToggleCategories}
		>
			Categories
		</button>
		{#if hasActiveFilters}
			<button type="button" onclick={onClearFilters} class="notes-toolbar__text">Clear</button>
		{/if}
	</div>

	{#if showCategoryTools}
		<div class="notes-toolbar__row">
			<button
				type="button"
				onclick={onDeleteSelectedCategory}
				disabled={selectedCategoryId === undefined || isCategoryBusy}
				class="notes-toolbar__text"
			>
				Delete selected
			</button>
		</div>
	{/if}

	{#if hasActiveFilters}
		<div class="notes-toolbar__row">
			<span class="notes-toolbar__label">Filtering by</span>
			{#if searchQuery}
				<span class="badge badge--primary">Search: "{searchQuery}"</span>
			{/if}
			{#if selectedCategory}
				<span class="badge badge--primary">Category: {selectedCategory}</span>
			{/if}
		</div>
	{/if}
</div>
