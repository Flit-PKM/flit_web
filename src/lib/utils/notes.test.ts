import { describe, expect, it, vi } from 'vitest';
import { buildRelatedTitleMap } from './notes';

describe('buildRelatedTitleMap', () => {
	it('reuses cached titles across calls to avoid repeated listing', async () => {
		const api = {
			getNote: vi.fn().mockResolvedValue({
				id: 2,
				title: 'Related Two'
			})
		};

		const noteData = {
			id: 1,
			relationships: [{ note_a_id: 1, note_b_id: 2, type: 'RELATED_TO', is_deleted: false }]
		};

		const first = await buildRelatedTitleMap(api as never, noteData as never);
		const second = await buildRelatedTitleMap(api as never, noteData as never);

		expect(first.get(2)).toBe('Related Two');
		expect(second.get(2)).toBe('Related Two');
		expect(api.getNote).toHaveBeenCalledTimes(1);
	});
});
