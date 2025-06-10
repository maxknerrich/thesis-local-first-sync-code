// These stores are kept for backward compatibility but are no longer used
// All data is now passed via SvelteKit load functions and form actions
import { writable } from 'svelte/store';
import type { Repository, Issue } from './types.js';

export const selectedRepository = writable<Repository | null>(null);
export const repositories = writable<Repository[]>([]);
export const issues = writable<Issue[]>([]);
export const showCreateDialog = writable<boolean>(false);
