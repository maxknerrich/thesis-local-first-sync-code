import { X_Sync_Addon_Dexie } from '$lib/x-sync';
import { Dexie, type EntityTable } from 'dexie';
import type { Issue, Project, Repository } from './schema';

const db = new Dexie('LocalIssueDB', {
	addons: [X_Sync_Addon_Dexie],
}) as Dexie & {
	issues: EntityTable<Issue, 'id'>;
	projects: EntityTable<Project, 'id'>;
	repositories: EntityTable<Repository, 'id'>;
};

db.version(1).stores(
	{
		issues: '++id, github_number',
		projects: '++id, name',
		repositories: '++id, project_id',
	},
	{
		sync: ['issues', 'repositories'],
	},
);
export { db };
