import { errorLogger, type LogLevel } from '$lib/utils/error-handler';
import { debugLogger } from '$lib/utils/debug';

export type LogProfile = 'debug' | 'test' | 'deploy';

const PROFILE_TO_LEVEL: Record<LogProfile, LogLevel> = {
	debug: 'debug',
	test: 'warn',
	deploy: 'warn'
};

function isLogProfile(value: string): value is LogProfile {
	return value === 'debug' || value === 'test' || value === 'deploy';
}

export function resolveLogProfile({
	mode,
	envProfile
}: {
	mode: string;
	envProfile?: string;
}): LogProfile {
	if (envProfile && isLogProfile(envProfile)) {
		return envProfile;
	}

	if (mode === 'test') {
		return 'test';
	}

	if (mode === 'production') {
		return 'deploy';
	}

	return 'debug';
}

export function resolveLogLevel(profile: LogProfile): LogLevel {
	return PROFILE_TO_LEVEL[profile];
}

export function initializeLogging(): LogLevel {
	const profile = resolveLogProfile({
		mode: import.meta.env.MODE,
		envProfile: import.meta.env.VITE_LOG_PROFILE
	});
	const level = resolveLogLevel(profile);

	errorLogger.setLogLevel(level);
	debugLogger.syncFromLoggerLevel();
	errorLogger.logInfo('Logger initialized', {
		component: 'Logging',
		operation: 'initialize',
		mode: import.meta.env.MODE,
		profile,
		level
	});

	return level;
}
