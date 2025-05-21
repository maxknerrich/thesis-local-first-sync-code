import { make_sync_store, X_Sync_Addon_Dexie } from '$lib/x-sync';
import { Dexie, type EntityTable } from 'dexie';
import type { Comment, Issue, Project, User } from './schema';

const db = new Dexie('localissuedb', {
	addons: [X_Sync_Addon_Dexie],
}) as Dexie & {
	issues: EntityTable<Issue, 'id'>;
	projects: EntityTable<Project, 'id'>;
	comments: EntityTable<Comment, 'id'>;
	users: EntityTable<User, 'id'>;
};

db.version(1).stores({
	issues: make_sync_store('++id, github_number, user'),
	projects: make_sync_store('++id, user, name'),
	comments: '++id, issue_id, github_id, user',
	users: '++id, name, login',
});

export { db };
