import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounceTrailing } from './debounce';

describe('debounceTrailing', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('runs fn once after delay from last schedule', async () => {
		const fn = vi.fn();
		const d = debounceTrailing(fn, 1000);
		d.schedule('a');
		d.schedule('b');
		expect(fn).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('b');
	});

	it('cancel drops pending call', async () => {
		const fn = vi.fn();
		const d = debounceTrailing(fn, 1000);
		d.schedule(1);
		d.cancel();
		await vi.advanceTimersByTimeAsync(1000);
		expect(fn).not.toHaveBeenCalled();
	});

	it('flush runs immediately with latest args', async () => {
		const fn = vi.fn().mockResolvedValue(undefined);
		const d = debounceTrailing(fn, 1000);
		d.schedule('x');
		const p = d.flush();
		await p;
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('x');
		await vi.advanceTimersByTimeAsync(1000);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('flush with nothing scheduled resolves', async () => {
		const fn = vi.fn();
		const d = debounceTrailing(fn, 1000);
		await d.flush();
		expect(fn).not.toHaveBeenCalled();
	});
});
