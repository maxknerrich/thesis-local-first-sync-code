import Dexie, { type EntityTable } from 'dexie';
import type { Comment, Issue, Project, User } from './schema';

const db = new Dexie('localissuedb') as Dexie & {
	issues: EntityTable<Issue, 'id'>;
	projects: EntityTable<Project, 'id'>;
	comments: EntityTable<Comment, 'id'>;
	users: EntityTable<User, 'id'>;
};

db.version(1).stores({
	issues: '++id, github_number, user',
	projects: '++id, user, name',
	comments: '++id, issue_id, github_id, user',
	users: '++id, name, login',
});

export { db };
