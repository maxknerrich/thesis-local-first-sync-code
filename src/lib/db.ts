import { X_Sync_Addon_Dexie } from '$lib/x-sync';
import { Dexie, type EntityTable } from 'dexie';
import type { Issue, Project } from './schema';

const db = new Dexie('LocalIssueDB', {
	addons: [X_Sync_Addon_Dexie],
}) as Dexie & {
	issues: EntityTable<Issue, 'id'>;
	projects: EntityTable<Project, 'id'>;
};

db.version(1).stores(
	{
		issues: '++id, github_number, user',
		projects: '++id, user, name',
	},
	{
		sync: ['issues', 'projects'],
	},
);
export { db };
