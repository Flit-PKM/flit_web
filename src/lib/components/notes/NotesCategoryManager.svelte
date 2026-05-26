<script lang="ts">
	let {
		showCreateCategory = false,
		newCategoryName = '',
		categoryError = '',
		isCategoryBusy = false,
		onNameInput,
		onSubmit,
		onCancel
	}: {
		showCreateCategory?: boolean;
		newCategoryName?: string;
		categoryError?: string;
		isCategoryBusy?: boolean;
		onNameInput: (value: string) => void;
		onSubmit: () => void;
		onCancel: () => void;
	} = $props();
</script>

{#if showCreateCategory}
	<div class="card__row card__row--start">
		<input
			type="text"
			value={newCategoryName}
			oninput={(e) => onNameInput(e.currentTarget.value)}
			placeholder="New category name"
			class="input"
			onkeydown={(e) => e.key === 'Enter' && onSubmit()}
		/>
		<button type="button" onclick={onSubmit} disabled={isCategoryBusy} class="btn btn-primary"
			>Create</button
		>
		<button type="button" onclick={onCancel} disabled={isCategoryBusy} class="btn btn-secondary"
			>Cancel</button
		>
		{#if categoryError}
			<span class="form-group__error">{categoryError}</span>
		{/if}
	</div>
{/if}
