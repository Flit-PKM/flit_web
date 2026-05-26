<script lang="ts">
	import type { NoteRead } from '$lib/types/note';

	let {
		open = false,
		query = '',
		results = [],
		loading = false,
		error = '',
		inputEl = $bindable(null as HTMLInputElement | null),
		onQueryChange,
		onSelect,
		onClose,
		onKeydown
	}: {
		open?: boolean;
		query?: string;
		results?: NoteRead[];
		loading?: boolean;
		error?: string;
		inputEl?: HTMLInputElement | null;
		onQueryChange: (value: string) => void;
		onSelect: (note: NoteRead) => void;
		onClose: () => void;
		onKeydown: (e: KeyboardEvent) => void;
	} = $props();
</script>

{#if open}
	<div
		class="modal-backdrop modal-backdrop--overlay"
		tabindex="-1"
		onkeydown={onKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="note-search-title"
		onclick={(e) => e.target === e.currentTarget && onClose()}
	>
		<div class="card note-search-dialog" role="document">
			<h2 id="note-search-title" class="section-title--muted">Select note to link</h2>
			<input
				bind:this={inputEl}
				type="text"
				value={query}
				oninput={(e) => onQueryChange(e.currentTarget.value)}
				placeholder="Search notes…"
				class="input"
			/>
			{#if error}
				<p class="form-group__error" role="alert">{error}</p>
			{/if}
			<div class="note-search-dialog__scroll">
				{#if loading}
					<p class="card__empty">Loading…</p>
				{:else if results.length === 0}
					<p class="card__empty">{query.trim() ? 'No notes found.' : 'Type to search.'}</p>
				{:else}
					<ul class="note-search-dialog__list">
						{#each results as n (n.id)}
							<li>
								<button
									type="button"
									onclick={() => onSelect(n)}
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
				<button type="button" onclick={onClose} class="btn btn-secondary">Cancel</button>
			</div>
		</div>
	</div>
{/if}
