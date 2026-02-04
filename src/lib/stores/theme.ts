/**
 * Theme store for unsaved color scheme preference.
 * When set (e.g. on profile page), the layout uses this for immediate preview
 * instead of the saved user preference until the user navigates away or saves.
 */

import { writable } from 'svelte/store';
import type { ColorScheme } from '$lib/types/auth';

export const pendingColorScheme = writable<ColorScheme | null>(null);
