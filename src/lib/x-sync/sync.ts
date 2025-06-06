import { AsyncQueuer } from '@tanstack/pacer';
import type Dexie from 'dexie';
import type { Table } from 'dexie';
import { createManager, type Manager } from 'tinytick';
import type {
	ConflictItem,
	DBObject,
	PullItem,
	PullResult,
	Result,
	syncConfig,
	TableMetadata,
	WriteLogEntry,
} from './types';
import { diffObject } from './utils';

type CategoriesObject = {
	newLocal: { item: DBObject; data: Omit<DBObject, 'remote_id' | 'id'> }[];
	newRemote: PullItem[];
	updatedLocal: { item: DBObject; changes: Partial<DBObject> }[];
	updatedRemote: { key: number; changes: Partial<PullItem> }[];
	deletedLocal: DBObject[];
	conflicts: {
		key: number;
		item: DBObject;
		changes: Partial<DBObject>;
	}[];
};

type CreateItem = {
	table: string;
	data: Omit<DBObject, 'remote_id' | 'id'>;
	item: DBObject;
};
type UpdateItem = {
	table: string;
	data: DBObject;
	item: DBObject;
};
type DeleteItem = {
	table: string;
	item: DBObject;
};

type LastSync<TDB> = Record<keyof TDB, TableMetadata>;

type CreateReturn = { key: number; changes: Partial<PullItem> };

export abstract class SyncBase<TDB extends Dexie = Dexie> {
	protected db: TDB;
	protected syncedTables: (keyof TDB)[];
	private readonly manager: Manager;
	private readonly default_interval = 5 * 60 * 1000;
	private lastSync: LastSync<TDB>;
	private syncConfig?: syncConfig;

	constructor({ db, syncConfig }: { db: TDB; syncConfig?: syncConfig }) {
		this.db = db;
		this.manager = createManager();

		if (syncConfig) {
			Object.keys(syncConfig).forEach((table) => {
				if (!this.db._syncedStores.includes(table)) {
					throw new Error(
						`Table ${table} is not a synced table in the database.`,
					);
				}
			});
			this.syncConfig = syncConfig;
			this.syncedTables = Object.keys(syncConfig) as (keyof TDB)[];
		} else {
			this.syncedTables = db._syncedStores as (keyof TDB)[];
		}
		this.manager.setTask(
			'sync',
			async (_, signal) => this.sync(signal),
			'syncHandler',
		);
		this.manager.setTask(
			'syncTable',
			async (table) => this.syncTable(table as keyof TDB),
			'syncHandler',
		);

		// Initialize with default values
		this.lastSync = {} as LastSync<TDB>;
		for (const table of this.syncedTables) {
			this.lastSync[table] = {
				lastSync: 'never',
				status: 'idle',
			} as TableMetadata;
		}

		console.log(
			`SyncBase initialized with tables: ${this.syncedTables.join(', ')}`,
		);
		this.manager.start();

		// Initialize async data
		this.initializeAsync();
	}

	private async initializeAsync(): Promise<void> {
		try {
			const savedLastSync = await this.db._syncState.get('lastSync');

			if (savedLastSync && Object.keys(savedLastSync.value).length > 0) {
				this.lastSync = savedLastSync.value as LastSync<TDB>;
			}
		} catch (error) {
			console.error('Failed to load saved sync state:', error);
			// Keep the default initialization
		}
	}

	protected getSince(table: keyof TDB): null | Date {
		const lastSync = this.lastSync[table]?.lastSync;
		if (lastSync === 'never' || typeof lastSync === 'string' || !lastSync) {
			return null;
		}
		return lastSync;
	}

	abstract pullData(args: {
		table: string;
		since?: Date;
	}): Promise<Result<PullResult>>;
	abstract pushCreate({ table, item, data }: CreateItem): Promise<CreateReturn>;
	abstract pushUpdate({ table, item, data }: UpdateItem): Promise<void>;
	abstract pushDelete({ table, item }: DeleteItem): Promise<void>;

	protected async sync(signal: AbortSignal): Promise<void> {
		if (signal.aborted) {
			return;
		}
		for (const table of this.syncedTables) {
			const syncConfig = this.syncConfig?.[table as string];
			if (syncConfig?.mode === 'manual') {
				console.log(`Skipping sync for table ${table as string} (manual mode)`);
				continue;
			}
			const lastSync = this.lastSync[table]?.lastSync;

			if (!lastSync) continue;

			if (lastSync === 'never' || typeof lastSync === 'string' || !lastSync) {
				this.manager.scheduleTaskRun('syncTable', table as string);
				continue;
			}

			const differenceInMinutes =
				Math.abs(Date.now() - lastSync.getTime()) / 60000;

			if (
				differenceInMinutes <=
				(syncConfig?.syncInterval ?? this.default_interval)
			) {
				continue;
			}

			this.manager.scheduleTaskRun('syncTable', table as string);
		}
	}
	private getWritesPerObject(
		writeLog: WriteLogEntry[],
	): Map<number, WriteLogEntry[]> {
		const writesPerObject = new Map<number, WriteLogEntry[]>();
		for (const entry of writeLog) {
			if (!writesPerObject.has(entry.object_id)) {
				writesPerObject.set(entry.object_id, [entry]);
				continue;
			}
			writesPerObject.get(entry.object_id)?.push(entry);
		}
		return writesPerObject;
	}

	private async markSynced(table: keyof TDB) {
		this.lastSync[table] = {
			lastSync: new Date(),
			status: 'synced',
		};
		await this.db._syncState.put({ key: 'lastSync', value: this.lastSync });
		console.log(
			`Table ${table as string} synced at ${this.lastSync[table].lastSync}`,
		);
	}
	private static calulateOldItem(item: DBObject, events: WriteLogEntry[]) {
		const old_data = events
			.toReversed()
			.reduce((acc, event) => Object.assign(acc, event.old_data), {});
		return Object.assign(item, old_data);
	}

	private handleConflict({
		localItem,
		remoteItem,
		writeLog,
	}: ConflictItem): Partial<DBObject> {
		const oldItem = SyncBase.calulateOldItem(localItem, writeLog);
		const remoteChanges = diffObject<PullItem>(oldItem, remoteItem);
		const GithubEvent = {
			new_data: remoteChanges,
		};
		const changes = this.materialize(
			writeLog.concat([GithubEvent as WriteLogEntry]),
		);
		return changes;
	}

	private categorizeChanges({
		writeLogPerObject,
		remoteData,
		localItems,
	}: {
		writeLogPerObject: Map<number, WriteLogEntry[]>;
		remoteData: PullResult;
		localItems: DBObject[];
	}) {
		const categories: CategoriesObject = {
			newLocal: [],
			newRemote: [],
			updatedLocal: [],
			updatedRemote: [],
			deletedLocal: [],
			conflicts: [],
		};
		const seenIDs = new Set<number>();
		for (const remoteItem of remoteData) {
			const localItem = localItems.find(
				(item) => item.remote_id === remoteItem.remote_id,
			);
			const writeLog = writeLogPerObject.get(localItem?.id ?? -1);
			if (localItem) {
				seenIDs.add(localItem.id);
				if (writeLog) {
					categories.conflicts.push({
						key: localItem.id,
						item: localItem,
						changes: this.handleConflict({
							localItem,
							remoteItem,
							writeLog,
						}),
					});
					continue;
				}
				categories.updatedRemote.push({
					key: localItem.id,
					changes: diffObject<PullItem>(localItem, remoteItem),
				});
				continue;
			}
			categories.newRemote.push(remoteItem);
		}
		for (const [key, value] of writeLogPerObject.entries()) {
			if (seenIDs.has(key)) continue;
			const localItem = localItems.find((item) => item.id === key) as DBObject;
			if (value.find((entry) => entry.method === 'create')) {
				const data = this.materialize(value);
				categories.newLocal.push({ item: localItem, data });
				continue;
			}
			const deltedEntry = value.find((entry) => entry.method === 'delete');
			if (
				deltedEntry?.old_data &&
				Object.hasOwn(deltedEntry.old_data as DBObject, 'remote_id')
			) {
				categories.deletedLocal.push(localItem);
				continue;
			}
			categories.updatedLocal.push({
				item: localItem,
				changes: this.materialize(value),
			});
		}
		return categories;
	}

	private materialize(writeLog: WriteLogEntry[]): DBObject {
		const data = writeLog.reduce(
			(acc, event) => Object.assign(acc, event.new_data),
			{},
		);
		return data as DBObject;
	}

	private async applyChanges(categories: CategoriesObject, table: keyof TDB) {
		const localTable = this.db[table] as Dexie.Table<unknown, string | number>;
		let localUpdatesFromRemote: CreateReturn[] = [];
		const pushQueue = new AsyncQueuer(
			async (
				item:
					| { type: 'create'; data: CreateItem }
					| { type: 'update'; data: UpdateItem }
					| { type: 'delete'; data: DeleteItem },
			) => {
				const { type, data } = item;
				if (type === 'create') {
					return await this.pushCreate(data).then((item) =>
						localUpdatesFromRemote.push(item),
					);
				} else if (type === 'update') {
					return await this.pushUpdate(data);
				} else if (type === 'delete') {
					return await this.pushDelete(data);
				}
			},
			{
				concurrency: 5,
			},
		);
		const {
			newLocal,
			newRemote,
			updatedLocal,
			updatedRemote,
			deletedLocal,
			conflicts,
		} = categories;

		for (const item of newLocal) {
			pushQueue.addItem({
				type: 'create',
				data: { table: 'issues', item: item.item, data: item.data },
			});
		}
		for (const item of updatedLocal) {
			pushQueue.addItem({
				type: 'update',
				data: {
					table: 'issues',
					item: item.item,
					data: item.changes as DBObject,
				},
			});
		}
		for (const item of deletedLocal) {
			pushQueue.addItem({
				type: 'delete',
				data: {
					table: 'issues',
					item,
				},
			});
		}
		for (const item of conflicts) {
			pushQueue.addItem({
				type: 'update',
				data: {
					table: 'issues',
					item: item.item,
					data: item.changes as DBObject,
				},
			});
		}
		while (pushQueue.getIsRunning() && !pushQueue.getIsEmpty()) {}
		await this.db.transaction('rw', localTable, async (trans) => {
			trans._isSyncTransaction = true;
			localTable.bulkAdd(newRemote);
			localTable.bulkUpdate(updatedRemote);
			if (localUpdatesFromRemote.length > 0) {
				localTable.bulkUpdate(localUpdatesFromRemote);
			}
			localTable.bulkUpdate(
				conflicts.map((item) => ({ key: item.key, changes: item.changes })),
			);
		});
	}

	async syncTable(table: keyof TDB) {
		if (typeof table !== 'string') {
			throw new Error('Table name must be a string');
		}
		this.lastSync[table].status = 'syncing';
		const localTable = this.db[table] as Dexie.Table<unknown, string | number>;
		const since = this.getSince(table);
		const fetchArgs = since ? { table, since } : { table };

		const [remoteData, writeLog] = await Promise.all([
			this.pullData(fetchArgs),
			this.db._writeLog.where('table').equals(table).sortBy('number'),
		]);
		if (remoteData.error) {
			console.error(`Error pulling data for table ${table}:`, remoteData.error);
			return;
		}
		if (remoteData.data.length === 0 && writeLog.length === 0) {
			console.log(`No data to sync for table ${table}`);

			this.markSynced(table);
			return;
		}
		const writeLogPerObject = this.getWritesPerObject(writeLog);
		const localItems = (await localTable
			.where('id')
			.anyOf(Array.from(writeLogPerObject.keys()) ?? [-1])
			.or('remote_id')
			.anyOf(remoteData.data.map((item) => item.remote_id) ?? [-1])
			.toArray()) as DBObject[] | [];
		const categories = this.categorizeChanges({
			writeLogPerObject,
			remoteData: remoteData.data,
			localItems,
		});
		if (this.syncConfig?.[table]?.path === 'r') {
			await this.handleReadOnly({ localTable, categories });
		} else {
			await this.applyChanges(categories, table);
		}
		// Clear the write log for the table
		await this.db._writeLog.bulkDelete(writeLog.map((entry) => entry.number));
		this.markSynced(table);
	}
	private async handleReadOnly({
		localTable,
		categories,
	}: {
		localTable: Dexie.Table<unknown, string | number>;
		categories: CategoriesObject;
	}) {
		const { newRemote, updatedRemote } = categories;
		await this.db.transaction('rw', localTable, async (trans) => {
			trans._isSyncTransaction = true;
			localTable.bulkAdd(newRemote);
			localTable.bulkUpdate(updatedRemote);
		});
	}
}
