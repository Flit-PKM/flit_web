import { beforeEach, describe, expect, it, vi } from 'vitest';
import { debugLogger } from './debug';
import { errorLogger } from './error-handler';

describe('debugLogger', () => {
	beforeEach(() => {
		vi.stubGlobal('console', {
			...console,
			error: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn()
		});
		errorLogger.setLogLevel('error');
		debugLogger.disable();
	});

	it('syncs from logger level', () => {
		errorLogger.setLogLevel('debug');
		debugLogger.syncFromLoggerLevel();
		debugLogger.log('test message');
		expect(console.debug).toHaveBeenCalled();
	});

	it('measures async functions and logs performance', async () => {
		debugLogger.enable();
		const value = await debugLogger.measure('sleep', async () => 42);
		expect(value).toBe(42);
		expect(console.debug).toHaveBeenCalled();
	});
});
