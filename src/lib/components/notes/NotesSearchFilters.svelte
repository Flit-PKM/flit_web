<script lang="ts">
	import type { CategoryRead } from '$lib/types/note';

	let {
		searchQuery = '',
		selectedCategory = '',
		categories = [],
		hasActiveFilters = false,
		isCategoryBusy = false,
		selectedCategoryId,
		onSearchInput,
		onCategoryChange,
		onClearFilters,
		onOpenCreateCategory,
		onDeleteSelectedCategory
	}: {
		searchQuery?: string;
		selectedCategory?: string;
		categories?: CategoryRead[];
		hasActiveFilters?: boolean;
		isCategoryBusy?: boolean;
		selectedCategoryId?: number;
		onSearchInput: (event: Event) => void;
		onCategoryChange: (event: Event) => void;
		onClearFilters: () => void;
		onOpenCreateCategory: () => void;
		onDeleteSelectedCategory: () => void;
	} = $props();
</script>

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
				oninput={onSearchInput}
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
				onchange={onCategoryChange}
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
				onclick={onOpenCreateCategory}
				disabled={isCategoryBusy}
				class="btn"
				title="Create category">+</button
			>
			<button
				type="button"
				onclick={onDeleteSelectedCategory}
				disabled={selectedCategoryId === undefined || isCategoryBusy}
				class="btn"
				title="Delete selected category">−</button
			>
			{#if hasActiveFilters}
				<button type="button" onclick={onClearFilters} class="btn"> Clear </button>
			{/if}
		</div>
	</div>
</div>

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
