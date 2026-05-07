import { describe, expect, it } from 'vitest';
import { filterNotDeleted } from './filter';

describe('filterNotDeleted', () => {
	it('filters soft-deleted entries', () => {
		const result = filterNotDeleted([
			{ id: 1, is_deleted: false },
			{ id: 2, is_deleted: true },
			{ id: 3 }
		]);
		expect(result.map((x) => x.id)).toEqual([1, 3]);
	});

	it('returns empty array for nullish input', () => {
		expect(filterNotDeleted(undefined)).toEqual([]);
		expect(filterNotDeleted(null)).toEqual([]);
	});
});
