import type Dexie from 'dexie';
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
	newLocal: { id: number; data: Omit<DBObject, 'remote_id' | 'id'> }[];
	newRemote: PullItem[];
	updatedLocal: { remote_id: string; changes: Partial<DBObject> }[];
	updatedRemote: { key: number; changes: Partial<PullItem> }[];
	deletedLocal: string[];
	conflicts: {
		key: number;
		remote_id: string;
		changes: Partial<DBObject>;
	}[];
};

type CreateReturn = { key: number; changes: Partial<PullItem> };

export abstract class SyncBase<TBD extends Dexie = Dexie> {
	protected db: TBD;
	protected syncedTables: string[];
	private readonly manager: Manager;
	private readonly default_interval = 5 * 60 * 1000;
	private lastSync: Map<string, TableMetadata>;
	private syncConfig?: syncConfig;

	constructor({ db, syncConfig }: { db: TBD; syncConfig?: syncConfig }) {
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
			this.syncedTables = Object.keys(syncConfig);
		} else {
			this.syncedTables = db._syncedStores;
		}
		this.manager.setTask(
			'sync',
			async (_, signal) => this.sync(signal),
			'syncHandler',
		);
		this.manager.setTask(
			'syncTable',
			async (table) => this.syncTable(table as keyof typeof this.db),
			'syncHandler',
		);
		this.lastSync = new Map();
		for (const table of this.syncedTables) {
			this.lastSync.set(table, { lastSync: 'never', status: 'idle' });
		}
		console.log(
			`SyncBase initialized with tables: ${this.syncedTables.join(', ')}`,
		);
		this.manager.start();
		this.manager.scheduleTaskRun('sync');
	}

	protected getSince(table: string): null | Date {
		const lastSync = this.lastSync.get(table)?.lastSync;
		if (lastSync === 'never' || typeof lastSync === 'string' || !lastSync) {
			return null;
		}
		return lastSync;
	}

	abstract pullData(args: {
		table: string;
		since?: Date;
	}): Promise<Result<PullResult>>;
	abstract pushCreate({
		table,
		id,
		data,
	}: {
		table: string;
		id: number;
		data: DBObject;
	}): Promise<CreateReturn>;
	abstract pushUpdate({
		table,
		remote_id,
		data,
	}: {
		table: string;
		remote_id: string;
		data: DBObject;
	}): Promise<void>;
	abstract pushDelete({
		table,
		remote_id,
	}: {
		table: string;
		remote_id: number | string;
	}): Promise<void>;

	protected async sync(signal: AbortSignal): Promise<void> {
		if (signal.aborted) {
			return;
		}
		for (const table of this.syncedTables) {
			const syncConfig = this.syncConfig?.[table];
			if (syncConfig?.mode === 'manual') {
				console.log(`Skipping sync for table ${table} (manual mode)`);
				continue;
			}
			const lastSync = this.lastSync.get(table)?.lastSync;

			if (!lastSync) continue;

			if (lastSync === 'never' || typeof lastSync === 'string' || !lastSync) {
				this.manager.scheduleTaskRun('syncTable', table);
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

			this.manager.scheduleTaskRun('syncTable', table);
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

	private markSynced(table: string) {
		this.lastSync.set(table, {
			lastSync: new Date(),
			status: 'synced',
		});
		console.log(`Table ${table} synced successfully.`);
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
						remote_id: localItem.remote_id,
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
			if (value.find((entry) => entry.method === 'create')) {
				const { id, ...data } = this.materialize(value);
				categories.newLocal.push({ id, data });
				continue;
			}
			const deltedEntry = value.find((entry) => entry.method === 'delete');
			if (
				deltedEntry?.old_data &&
				Object.hasOwn(deltedEntry.old_data as DBObject, 'remote_id')
			) {
				categories.deletedLocal.push(deltedEntry.old_data.remote_id as string);
				continue;
			}
			categories.updatedLocal.push({
				remote_id: localItems.find((e) => e.id === key)?.remote_id as string,
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

	private async applyChanges(categories: CategoriesObject, table: keyof TBD) {
		const localTable = this.db[table] as Dexie.Table<unknown, string | number>;
		const {
			newLocal,
			newRemote,
			updatedLocal,
			updatedRemote,
			deletedLocal,
			conflicts,
		} = categories;

		let requests = [];
		let localUpdatesFromRemote: CreateReturn[] = [];

		for (const item of newLocal) {
			requests.push(
				this.pushCreate({ table: 'issues', id: item.id, data: item.data }).then(
					(item) => localUpdatesFromRemote.push(item),
				),
			);
		}
		for (const item of updatedLocal) {
			requests.push(
				this.pushUpdate({
					table: 'issues',
					remote_id: item.remote_id,
					data: item.changes as DBObject,
				}),
			);
		}
		for (const item of deletedLocal) {
			requests.push(
				this.pushDelete({
					table: 'issues',
					remote_id: item,
				}),
			);
		}
		for (const item of conflicts) {
			requests.push(
				this.pushUpdate({
					table: 'issues',
					remote_id: item.remote_id,
					data: item.changes as DBObject,
				}),
			);
		}
		await Promise.all(requests);

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

	async syncTable(table: keyof TBD) {
		if (typeof table !== 'string') {
			throw new Error('Table name must be a string');
		}
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
		await this.applyChanges(categories, table);
		this.markSynced(table);
	}
}
