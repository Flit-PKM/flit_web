import { describe, expect, it } from 'vitest';
import { resolveLogLevel, resolveLogProfile } from './log-config';

describe('resolveLogProfile', () => {
	it('uses explicit valid env profile', () => {
		expect(resolveLogProfile({ mode: 'development', envProfile: 'debug' })).toBe('debug');
		expect(resolveLogProfile({ mode: 'development', envProfile: 'test' })).toBe('test');
		expect(resolveLogProfile({ mode: 'development', envProfile: 'deploy' })).toBe('deploy');
	});

	it('falls back to mode defaults when env is missing or invalid', () => {
		expect(resolveLogProfile({ mode: 'test' })).toBe('test');
		expect(resolveLogProfile({ mode: 'production' })).toBe('deploy');
		expect(resolveLogProfile({ mode: 'development' })).toBe('debug');
		expect(resolveLogProfile({ mode: 'development', envProfile: 'invalid' })).toBe('debug');
	});
});

describe('resolveLogLevel', () => {
	it('maps profiles to levels', () => {
		expect(resolveLogLevel('debug')).toBe('debug');
		expect(resolveLogLevel('test')).toBe('warn');
		expect(resolveLogLevel('deploy')).toBe('warn');
	});
});
