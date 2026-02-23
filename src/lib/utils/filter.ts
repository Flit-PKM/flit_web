/**
 * Filter helpers for API responses that include soft-deleted items.
 */

export function filterNotDeleted<T extends { is_deleted?: boolean }>(
	arr: T[] | undefined | null
): T[] {
	return (arr ?? []).filter((x) => !x.is_deleted);
}
