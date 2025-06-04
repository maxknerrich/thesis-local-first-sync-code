/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: <explanation> */

import type { Issue } from '$lib/schema';
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	mock,
	test,
} from 'bun:test';
import Dexie, { type EntityTable } from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { X_Sync_Addon_Dexie } from './db';
import { type DBObject, type PullResult, type Result, SyncBase } from './sync';

const db = new Dexie('LocalIssueDB', {
	addons: [X_Sync_Addon_Dexie],
	indexedDB: indexedDB,
	IDBKeyRange: IDBKeyRange,
}) as Dexie & {
	issues: EntityTable<Issue, 'id'>;
};

db.version(1).stores(
	{
		issues: '++id, github_number, user',
	},
	{
		sync: ['issues'],
	},
);

afterEach(async () => {
	db.delete({ disableAutoOpen: false });
});

let testType: TestType = 'no';
type TestType = 'initial' | 'no' | 'localonly' | 'remoteonly' | 'conflict';
const fetchIssues = mock((type: TestType) => {
	switch (type) {
		case 'initial':
			return [
				{
					title: 'Issue 1',
					description: 'This is a new Issue',
					priority: 1,
					status: 0,
					github_number: 1,
					remote_id: '31',
				},
				{
					title: 'Issue 2',
					description: 'This is a new Issue',
					priority: 1,
					status: 0,
					github_number: 2,
					remote_id: '32',
				},
			];
		case 'remoteonly':
			return [
				{
					title: 'Issue 2',
					description: 'This is a Remote Update',
					priority: 1,
					status: 0,
					github_number: 2,
					remote_id: '32',
				},
				{
					title: 'Issue 3',
					description: 'This is a new issue',
					priority: 1,
					github_number: 3,
					status: 0,
					remote_id: '33',
				},
				{
					title: 'Issue 4',
					description: 'This is a new issue',
					status: 0,
					priority: 1,
					github_number: 4,
					remote_id: '34',
				},
			];

		case 'conflict':
			return [
				{
					title: 'Issue 1',
					description: 'This is only remote change',
					priority: 1,
					status: 0,
					github_number: 1,
					remote_id: '31',
				},
				{
					title: 'Issue 2',
					description: 'This is remote and local Changes',
					priority: 1,
					status: 0,
					github_number: 2,
					remote_id: '32',
				},
				{
					title: 'Issue 3',
					description: 'This is a new issue',
					status: 0,
					priority: 1,
					github_number: 3,
					remote_id: '33',
				},
				{
					title: 'Issue 4',
					description: 'This is a new issue',
					status: 0,
					priority: 1,
					github_number: 4,
					remote_id: '34',
				},
			];
		default:
			return [];
	}
});

const localConflict = async () => {
	await db.issues.update(2, {
		title: 'Hey was geht ab',
	});
	await db.issues.update(2, {
		status: 1,
	});
	await db.issues.update(2, {
		description: 'Local Update',
		priority: 2,
	});
	await db.issues.update(2, {
		title: 'Issue wurde local geupdatet',
	});
};

const localNew = async () => {
	await db.issues.add({
		title: 'Issue 5',
		description: 'This is a new Issue',
		priority: 1,
		status: 0,
	});
};

class TestSync extends SyncBase<typeof db> {
	async pullData({
		table,
		since,
	}: {
		table: string;
		since: Date;
	}): Promise<Result<PullResult>> {
		switch (table) {
			case 'issues': {
				const issues = fetchIssues(testType);
				return { error: null, data: issues.flat() };
			}
			default:
				return { data: null, error: new Error(`Unknown table: ${table}`) };
		}
	}
	async pushCreate({
		table,
		data,
	}: {
		table: string;
		data: DBObject;
	}): Promise<void> {
		return;
	}
	async pushDelete({
		table,
		id,
		remote_id,
	}: {
		table: string;
		id: number;
		remote_id: number | string;
	}): Promise<void> {
		return;
	}
	async pushUpdate({
		table,
		data,
	}: {
		table: string;
		data: DBObject;
	}): Promise<void> {
		return;
	}
}

const seed = async () => {
	await db.issues.bulkAdd([
		{
			id: 1,
			title: 'Issue 1',
			description: 'This is a new Issue',
			priority: 1,
			status: 0,
			github_number: 1,
			remote_id: '31',
		},
		{
			id: 2,
			title: 'Issue 2',
			description: 'This is a new Issue',
			priority: 1,
			status: 0,
			github_number: 2,
			remote_id: '32',
		},
	]);
};

const sync = new TestSync({
	db,
	syncConfig: {
		issues: {
			mode: 'auto',
			syncInterval: 5 * 60,
		},
	},
});

test('Initial Test', async () => {
	testType = 'initial';
	const cat = await sync.syncTable('issues');
	expect(cat).toEqual({
		newLocal: [],
		newRemote: [
			{
				title: 'Issue 1',
				description: 'This is a new Issue',
				priority: 1,
				status: 0,
				github_number: 1,
				remote_id: '31',
			},
			{
				title: 'Issue 2',
				description: 'This is a new Issue',
				priority: 1,
				status: 0,
				github_number: 2,
				remote_id: '32',
			},
		],
		updatedLocal: [],
		updatedRemote: [],
		deletedLocal: [],
		conflicts: [],
	});
});

test('Only Remote Updates', async () => {
	await seed();
	testType = 'remoteonly';
	const cat = await sync.syncTable('issues');
	expect(cat).toEqual({
		newLocal: [],
		newRemote: [
			{
				title: 'Issue 3',
				description: 'This is a new issue',
				priority: 1,
				github_number: 3,
				status: 0,
				remote_id: '33',
			},
			{
				title: 'Issue 4',
				description: 'This is a new issue',
				status: 0,
				priority: 1,
				github_number: 4,
				remote_id: '34',
			},
		],
		updatedLocal: [],
		updatedRemote: [
			{
				id: 2,
				data: {
					description: 'This is a Remote Update',
				},
			},
		],
		deletedLocal: [],
		conflicts: [],
	});
});

test('Only Local Updates', async () => {
	await seed();
	await localNew();
	await localConflict();
	testType = 'localonly';
	const cat = await sync.syncTable('issues');
	expect(cat).toEqual({
		newLocal: [
			{
				id: 3,
				title: 'Issue 5',
				description: 'This is a new Issue',
				priority: 1,
				status: 0,
			},
		],
		newRemote: [],
		updatedLocal: [
			{
				remote_id: '32',
				data: {
					title: 'Issue wurde local geupdatet',
					description: 'Local Update',
					priority: 2,
					status: 1,
				},
			},
		],
		updatedRemote: [],
		deletedLocal: [],
		conflicts: [],
	});
});

test('Check conflict', async () => {
	await seed();
	await localNew();
	await localConflict();
	testType = 'conflict';
	const cat = await sync.syncTable('issues');
	expect(cat).toEqual({
		newLocal: [
			{
				id: 3,
				title: 'Issue 5',
				description: 'This is a new Issue',
				priority: 1,
				status: 0,
			},
		],
		newRemote: [
			{
				title: 'Issue 3',
				description: 'This is a new issue',
				status: 0,
				priority: 1,
				github_number: 3,
				remote_id: '33',
			},
			{
				title: 'Issue 4',
				description: 'This is a new issue',
				status: 0,
				priority: 1,
				github_number: 4,
				remote_id: '34',
			},
		],
		updatedLocal: [],
		updatedRemote: [
			{
				id: 1,
				data: {
					description: 'This is only remote change',
				},
			},
		],
		deletedLocal: [],
		conflicts: [
			{
				id: 2,
				remote_id: '32',
				data: {
					title: 'Issue wurde local geupdatet',
					description: 'This is remote and local Changes',
					priority: 2,
					status: 1,
				},
			},
		],
	});
});

test('Check local delete', async () => {
	await seed();
	testType = 'localonly';
	await db.issues.update(2, { title: 'Should get deleted' });
	await db.issues.delete(2);
	const cat = await sync.syncTable('issues');
	expect(cat).toEqual({
		newLocal: [],
		newRemote: [],
		updatedLocal: [],
		updatedRemote: [],
		deletedLocal: ['32'],
		conflicts: [],
	});
});
