<script lang="ts">
	import { apiClient } from '$lib/api/client';
	import { confirmAction } from '$lib/stores/confirmDialog';
	import { captureApiError } from '$lib/utils/error-handler';

	const ACCEPTED_EXTENSIONS = ['.zip', '.md'];
	const ACCEPT_ATTR = '.zip,.md,application/zip,text/markdown';

	let vaultExportLoading = $state(false);
	let vaultExportError = $state('');
	let vaultImportFile = $state<File | null>(null);
	let vaultImportLoading = $state(false);
	let vaultImportError = $state('');
	let vaultImportSuccess = $state('');
	let vaultImportDragging = $state(false);
	let showImportHelp = $state(false);
	let vaultImportInputEl = $state<HTMLInputElement | null>(null);

	let vaultBusy = $derived(vaultExportLoading || vaultImportLoading);

	function isAcceptedImportFile(file: File): boolean {
		const name = file.name.toLowerCase();
		return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
	}

	function setVaultImportFile(file: File | null) {
		if (file && !isAcceptedImportFile(file)) {
			vaultImportError = 'Please choose a .zip backup or a single .md note file.';
			vaultImportFile = null;
			vaultImportSuccess = '';
			return;
		}
		vaultImportFile = file;
		vaultImportError = '';
		vaultImportSuccess = '';
	}

	function handleVaultImportFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		setVaultImportFile(input.files?.[0] ?? null);
	}

	function openVaultImportPicker() {
		if (vaultBusy) return;
		vaultImportInputEl?.click();
	}

	function handleVaultDrop(event: DragEvent) {
		event.preventDefault();
		vaultImportDragging = false;
		if (vaultBusy) return;
		const file = event.dataTransfer?.files?.[0];
		if (file) setVaultImportFile(file);
	}

	function handleVaultDragOver(event: DragEvent) {
		event.preventDefault();
		if (vaultBusy) return;
		vaultImportDragging = true;
	}

	function handleVaultDragLeave(event: DragEvent) {
		event.preventDefault();
		vaultImportDragging = false;
	}

	function clearVaultImportFile() {
		setVaultImportFile(null);
		if (vaultImportInputEl) vaultImportInputEl.value = '';
	}

	function closeImportHelp() {
		showImportHelp = false;
	}

	function handleImportHelpKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeImportHelp();
	}

	async function handleExportMarkdownVault() {
		vaultExportError = '';
		vaultExportLoading = true;
		try {
			const { blob, filename } = await apiClient.exportMarkdownVault();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = filename;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			vaultExportError = captureApiError(err, {
				component: 'Profile',
				operation: 'exportMarkdownVault'
			});
		} finally {
			vaultExportLoading = false;
		}
	}

	async function handleImportMarkdownVault() {
		if (!vaultImportFile) return;
		if (
			!(await confirmAction(
				'Import this file? New notes will be added to your vault. Existing notes are never changed or deleted.'
			))
		) {
			return;
		}
		vaultImportError = '';
		vaultImportSuccess = '';
		vaultImportLoading = true;
		try {
			const result = await apiClient.importMarkdownVault(vaultImportFile);
			vaultImportSuccess = `Import complete: ${result.notes_imported} note${result.notes_imported === 1 ? '' : 's'}, ${result.relationships_imported} relationship${result.relationships_imported === 1 ? '' : 's'} imported${result.relationships_skipped > 0 ? ` (${result.relationships_skipped} skipped)` : ''}.`;
			clearVaultImportFile();
		} catch (err) {
			vaultImportError = captureApiError(err, {
				component: 'Profile',
				operation: 'importMarkdownVault'
			});
		} finally {
			vaultImportLoading = false;
		}
	}
</script>

<div class="card">
	<div class="notes-transfer__header notes-transfer__header--balanced">
		<div class="notes-transfer__header-title">
			<h2>Import and Export Notes</h2>
			<p class="card__meta">Back up your notes or bring markdown files into Flit.</p>
		</div>
		<button
			type="button"
			class="btn btn--compact notes-transfer__help-btn"
			onclick={() => (showImportHelp = true)}
			aria-label="Open import and export help"
		>
			<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			Help
		</button>
	</div>

	{#if vaultExportError}
		<div class="alert alert--error" role="alert">
			<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
					clip-rule="evenodd"
				/>
			</svg>
			<p class="alert__message">{vaultExportError}</p>
		</div>
	{/if}

	{#if vaultImportError}
		<div class="alert alert--error" role="alert">
			<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
					clip-rule="evenodd"
				/>
			</svg>
			<p class="alert__message">{vaultImportError}</p>
		</div>
	{/if}

	{#if vaultImportSuccess}
		<div class="alert alert--success alert--mb-md" role="status">
			<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					clip-rule="evenodd"
				/>
			</svg>
			<p class="alert__message">{vaultImportSuccess}</p>
		</div>
	{/if}

	<div class="notes-transfer">
		<section class="notes-transfer__panel" aria-labelledby="notes-export-heading">
			<div class="notes-transfer__panel-icon" aria-hidden="true">
				<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
					/>
				</svg>
			</div>
			<h3 id="notes-export-heading" class="notes-transfer__panel-title">Export</h3>
			<p class="card__meta">
				Download a ZIP backup of your active notes—one UTF-8 markdown file per note.
			</p>
			<button
				type="button"
				class="btn btn-secondary notes-transfer__action"
				disabled={vaultBusy}
				onclick={handleExportMarkdownVault}
				aria-label="Export notes as ZIP backup"
			>
				{#if vaultExportLoading}
					<span class="loading__spinner loading__spinner--mr-sm" aria-hidden="true">
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
					Preparing download…
				{:else}
					Download ZIP backup
				{/if}
			</button>
		</section>

		<section class="notes-transfer__panel" aria-labelledby="notes-import-heading">
			<div class="notes-transfer__panel-icon" aria-hidden="true">
				<svg class="icon_md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
					/>
				</svg>
			</div>
			<h3 id="notes-import-heading" class="notes-transfer__panel-title">Import</h3>
			<p class="card__meta">Add notes from a Flit ZIP backup or a single markdown file.</p>

			<input
				bind:this={vaultImportInputEl}
				id="vault-import-file"
				type="file"
				accept={ACCEPT_ATTR}
				disabled={vaultBusy}
				onchange={handleVaultImportFileChange}
				class="notes-transfer__file-input"
				tabindex="-1"
			/>

			<div
				class="notes-transfer__dropzone"
				class:notes-transfer__dropzone--active={vaultImportDragging}
				class:notes-transfer__dropzone--has-file={!!vaultImportFile}
				role="button"
				tabindex={vaultBusy ? -1 : 0}
				aria-disabled={vaultBusy}
				aria-label="Drop a ZIP or markdown file here, or press Enter to browse"
				onclick={openVaultImportPicker}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && openVaultImportPicker()}
				ondrop={handleVaultDrop}
				ondragover={handleVaultDragOver}
				ondragleave={handleVaultDragLeave}
			>
				{#if vaultImportFile}
					<p class="notes-transfer__dropzone-filename">{vaultImportFile.name}</p>
					<p class="card__meta">
						{(vaultImportFile.size / 1024).toFixed(vaultImportFile.size >= 10240 ? 0 : 1)} KB · ready
						to import
					</p>
					<button
						type="button"
						class="btn btn--compact"
						disabled={vaultBusy}
						onclick={(e) => {
							e.stopPropagation();
							clearVaultImportFile();
						}}
					>
						Remove file
					</button>
				{:else}
					<p class="notes-transfer__dropzone-title">
						{vaultImportDragging ? 'Drop to import' : 'Drag & drop a file here'}
					</p>
					<p class="card__meta">or <span class="notes-transfer__browse">browse for a file</span></p>
					<p class="notes-transfer__formats">.zip backup or .md note</p>
				{/if}
			</div>

			<button
				type="button"
				class="btn btn-primary notes-transfer__action"
				disabled={vaultBusy || !vaultImportFile}
				onclick={handleImportMarkdownVault}
				aria-label="Import selected notes file"
			>
				{#if vaultImportLoading}
					<span class="loading__spinner loading__spinner--mr-sm" aria-hidden="true">
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
					Importing…
				{:else}
					Import notes
				{/if}
			</button>
		</section>
	</div>
</div>

{#if showImportHelp}
	<div
		class="modal-backdrop modal-backdrop--overlay"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-labelledby="notes-import-help-title"
		onkeydown={handleImportHelpKeydown}
		onclick={(e) => e.target === e.currentTarget && closeImportHelp()}
	>
		<div class="card notes-transfer-help" role="document">
			<div class="notes-transfer__header">
				<h2 id="notes-import-help-title" class="section-title--muted">Import & export help</h2>
				<button
					type="button"
					class="btn btn--compact"
					onclick={closeImportHelp}
					aria-label="Close help"
				>
					Close
				</button>
			</div>

			<div class="notes-transfer-help__body">
				<section>
					<h3 class="notes-transfer-help__heading">Export</h3>
					<ul class="notes-transfer-help__list">
						<li>Downloads a ZIP backup of your active notes (nothing in Trash).</li>
						<li>
							Each note is one <code>.md</code> file at the root of the archive, with title, body, categories,
							timestamps, and note relationships where both notes are in the export.
						</li>
						<li>Not included: soft-deleted notes, pin state, embeddings, or audio.</li>
						<li>Export needs at least one active note; otherwise it fails.</li>
					</ul>
				</section>

				<section>
					<h3 class="notes-transfer-help__heading">Import — ZIP backup</h3>
					<ul class="notes-transfer-help__list">
						<li>
							Use a Flit export ZIP (or another archive that follows the same layout: only
							<code>.md</code> files at the root, no folders).
						</li>
						<li>Every file in the ZIP is imported as a new note and merged into your vault.</li>
						<li>
							Categories are matched by name (existing categories are reused; new names are
							created).
						</li>
						<li>
							Relationships listed under <code>## Relationships</code> are recreated only between notes
							imported in that same upload.
						</li>
						<li>
							Nested folders, non-<code>.md</code> files at the root, or archives with no readable notes
							are rejected.
						</li>
					</ul>
				</section>

				<section>
					<h3 class="notes-transfer-help__heading">Import — single file</h3>
					<ul class="notes-transfer-help__list">
						<li>
							Import one <code>.md</code> note at a time—handy for a single document without a full backup.
						</li>
						<li>
							Same merge rules as ZIP: always adds a new note; relationships in the file only apply
							if the targets are part of that same import (for a single file, that usually means
							none).
						</li>
					</ul>
				</section>

				<section>
					<h3 class="notes-transfer-help__heading">Important</h3>
					<ul class="notes-transfer-help__list">
						<li>
							Import never replaces your vault. It always adds notes; it does not update or delete
							existing ones by title or filename.
						</li>
						<li>
							Re-importing the same export creates duplicates—including if titles match notes you
							already have.
						</li>
						<li>
							Relationship links are batch-local. They connect notes created in that one import
							only; they do not attach to notes already in your vault.
						</li>
						<li>
							Wikilinks in note text are not turned into relationships—only the structured
							<code>## Relationships</code> section is used.
						</li>
					</ul>
				</section>
			</div>

			<div class="confirm-dialog__actions">
				<button type="button" class="btn btn-primary" onclick={closeImportHelp}>Got it</button>
			</div>
		</div>
	</div>
{/if}
