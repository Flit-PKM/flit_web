import { writable } from 'svelte/store';
import { browser } from '$app/environment';

let pendingResolve: ((value: boolean) => void) | null = null;

export const confirmDialogOpen = writable(false);
export const confirmDialogMessage = writable('');

export function confirmAction(message: string): Promise<boolean> {
	if (!browser) return Promise.resolve(false);
	if (pendingResolve) pendingResolve(false);
	return new Promise((resolve) => {
		pendingResolve = resolve;
		confirmDialogMessage.set(message);
		confirmDialogOpen.set(true);
	});
}

export function resolveConfirmDialog(confirmed: boolean): void {
	confirmDialogOpen.set(false);
	confirmDialogMessage.set('');
	const resolve = pendingResolve;
	pendingResolve = null;
	resolve?.(confirmed);
}
