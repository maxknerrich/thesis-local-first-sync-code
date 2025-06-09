import type Dexie from 'dexie';
import { createManager, type Manager } from 'tinytick';
import { PushQueue } from './pushQueue';
import type {
	ConflictItem,
	DBObject,
	LastSync,
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

type CreateReturn = { key: number; changes: Partial<PullItem> };

export abstract class SyncBase<TDB extends Dexie = Dexie> {
	protected db: TDB;
	protected syncedTables: (keyof TDB)[];
	private readonly manager: Manager;
	private readonly default_interval = 5 * 60; // 5 minutes in seconds
	private lastSync: LastSync<TDB>;
	private syncConfig?: syncConfig;
	private initialData: { [K in keyof TDB]: Partial<DBObject> } | undefined;

	constructor({
		db,
		syncConfig,
		initialData,
	}: {
		db: TDB;
		syncConfig?: syncConfig;
		initialData?: { [K in keyof TDB]: Partial<DBObject> };
	}) {
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

		// Initialize with default values
		this.lastSync = {} as LastSync<TDB>;
		for (const table of this.syncedTables) {
			this.lastSync[table] = {
				lastSync: 'never',
				status: 'idle',
			} as TableMetadata;
		}

		if (initialData) {
			this.initialData = initialData;
		}

		console.log(
			`SyncBase initialized with tables: ${this.syncedTables.join(', ')}`,
		);

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
		// Check basic connectivity
		if (window.navigator.onLine === false) {
			this.offline();
			return;
		}

		// Check connection quality if supported
		if (
			'connection' in window.navigator &&
			//@ts-ignore
			window.navigator.connection?.effectiveType !== '4g'
		) {
			this.offline();
			return;
		}

		let tasks: string[] = [];
		for (const table of this.syncedTables) {
			const syncConfig = this.syncConfig?.[table as string];
			if (syncConfig?.mode === 'manual') {
				continue;
			}
			const lastSync = this.lastSync[table]?.lastSync;

			if (!lastSync) continue;

			if (lastSync === 'never' || typeof lastSync === 'string' || !lastSync) {
				tasks.push(
					this.manager.scheduleTaskRun('syncTable', table as string) ?? '',
				);
				continue;
			}

			const differenceInSeconds =
				Math.abs(Date.now() - lastSync.getTime()) / 1000;
			if (
				differenceInSeconds <=
				(syncConfig?.syncInterval ?? this.default_interval)
			) {
				continue;
			}

			tasks.push(
				this.manager.scheduleTaskRun('syncTable', table as string) ?? '',
			);
		}
		if (tasks.length > 0) {
			await Promise.all(
				tasks.map((task) => this.manager.untilTaskRunDone(task)),
			);
		}
		this.manager.scheduleTaskRun('sync', undefined, 10 * 1000); // run again in 10 seconds
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
	private static calculateOldItem(item: DBObject, events: WriteLogEntry[]) {
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
		const oldItem = SyncBase.calculateOldItem(localItem, writeLog);
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
		table,
	}: {
		writeLogPerObject: Map<number, WriteLogEntry[]>;
		remoteData: PullResult;
		localItems: DBObject[];
		table: keyof TDB;
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
			const initialData = this.initialData?.[table];
			categories.newRemote.push(
				initialData ? Object.assign(remoteItem, initialData) : remoteItem,
			);
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

	start() {
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
		this.manager.start();
		this.manager.scheduleTaskRun('sync');
	}

	private offline() {
		this.manager.setTask('check_offline', async () => {
			if (window.navigator.onLine) {
				if (!('connection' in window.navigator)) {
					this.start();
					return;
				}
				if (
					//@ts-ignore
					window.navigator.connection?.effectiveType === '4g'
				) {
					this.start();
					return;
				}
			}
			this.manager.scheduleTaskRun('check_offline', undefined, 500);
		});
		this.manager.delTask('sync');
		this.manager.delTask('syncTable');
		this.manager.scheduleTaskRun('check_offline', undefined, 500);
	}

	stop() {
		this.manager.stop();
	}

	private async applyChanges(categories: CategoriesObject, table: keyof TDB) {
		const localTable = this.db[table] as Dexie.Table<unknown, string | number>;
		const localUpdatesFromRemote: CreateReturn[] = [];

		// Create a push queue for handling remote operations
		const pushQueue = new PushQueue(100, 180); // 100 concurrent, 180 per minute

		const {
			newLocal,
			newRemote,
			updatedLocal,
			updatedRemote,
			deletedLocal,
			conflicts,
		} = categories;

		// Queue create operations
		for (const item of newLocal) {
			pushQueue.add(async () => {
				return this.pushCreate({
					table: table as string,
					item: item.item,
					data: item.data,
				}).then((result) => {
					localUpdatesFromRemote.push(result);
					return result;
				});
			});
		}

		// Queue update operations
		for (const item of updatedLocal) {
			pushQueue.add(async () => {
				return this.pushUpdate({
					table: table as string,
					item: item.item,
					data: item.changes as DBObject,
				});
			});
		}

		// Queue delete operations
		for (const item of deletedLocal) {
			pushQueue.add(async () => {
				return this.pushDelete({
					table: table as string,
					item,
				});
			});
		}

		// Queue conflict resolution operations
		for (const item of conflicts) {
			pushQueue.add(async () => {
				return this.pushUpdate({
					table: table as string,
					item: item.item,
					data: item.changes as DBObject,
				});
			});
		}

		// Mark queue as done and wait for all operations to complete
		await pushQueue.done();

		console.log('bulk updatee', localUpdatesFromRemote);
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

			await this.markSynced(table);
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
			table,
		});
		if (this.syncConfig?.[table]?.path === 'r') {
			await this.handleReadOnly({ localTable, categories });
		} else {
			await this.applyChanges(categories, table);
		}
		// Clear the write log for the table
		await this.db._writeLog.bulkDelete(writeLog.map((entry) => entry.number));
		await this.markSynced(table);
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
