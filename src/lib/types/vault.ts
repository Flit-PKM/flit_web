/**
 * Vault markdown import/export types (aligned with OpenAPI).
 */

export interface VaultMarkdownImportResult {
	notes_imported: number;
	relationships_imported: number;
	relationships_skipped: number;
}
