/**
 * Trailing-edge debounce: `fn` runs `delayMs` after the last call to `schedule`.
 * `flush()` runs any pending invocation immediately (and clears the timer).
 * `cancel()` drops the pending invocation without running `fn`.
 */
export function debounceTrailing<TArgs extends readonly unknown[]>(
	fn: (...args: TArgs) => void | Promise<void>,
	delayMs: number
): {
	schedule: (...args: TArgs) => void;
	cancel: () => void;
	flush: () => Promise<void>;
} {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: TArgs | null = null;

	const run = async () => {
		if (!lastArgs) return;
		const args = lastArgs;
		lastArgs = null;
		await fn(...args);
	};

	const schedule = (...args: TArgs) => {
		lastArgs = args;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void run();
		}, delayMs);
	};

	const cancel = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		lastArgs = null;
	};

	const flush = async () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (lastArgs) {
			await run();
		}
	};

	return { schedule, cancel, flush };
}
