import type Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import { createManager, type Manager } from 'tinytick';
import type { WriteLogEntry } from './entry';

type Result<T> =
	| {
			data: T;
			error: null;
	  }
	| {
			data: null;
			error: Error;
	  };

interface PullItem {
	remote_id: string;
	[key: string]: unknown;
}
export interface Object extends PullItem {
	id: number;
}

type PullResult = Object[];

export abstract class SyncBase {
	protected db: Dexie;
	protected syncedTables: string[];
	private readonly manager: Manager;
	private readonly sync_interval: number;
	private readonly listener;
	private lastSync: string = 'never';
	private status: 'idle' | 'syncing' | 'synced' =
		this.lastSync === 'never' ? 'idle' : 'synced';

	constructor(db: Dexie) {
		this.db = db;
		this.syncedTables = db._syncedStores;
		this.manager = createManager();
		this.sync_interval = 1 * 1000; // 1 second for testing, change to 5 minutes (300000) in production

		this.manager.setTask(
			'sync',
			async (_, signal) => this.sync(signal),
			'syncHandler',
			{
				maxDuration: 30 * 1000, // 30 seconds
				retryDelay: this.sync_interval,
				repeatDelay: this.sync_interval,
			},
		);
		this.manager.setTask(
			'syncTable',
			async (table) => this.syncTable(table as keyof typeof this.db),
			'syncHandler',
		);
		this.listener = this.manager.addRunningTaskRunIdsListener((manager) => {
			if (manager.getRunningTaskRunIds().length > 0) {
				this.status = 'syncing';
				return;
			}
			this.status = 'synced';
			this.lastSync = new Date().toISOString();
		});
		this.manager.scheduleTaskRun('sync');
	}

	abstract pullData({
		table,
		since,
	}: {
		table: string;
		since?: string;
	}): Promise<Result<PullResult>>;
	abstract pushCreate({
		table,
		data,
	}: {
		table: string;
		data: Object;
	}): Promise<Result<Object>>;
	abstract pushUpdate({
		table,
		data,
	}: {
		table: string;
		data: Object;
	}): Promise<Result<Object>>;
	abstract pushDelete({
		table,
		id,
		remote_id,
	}: {
		table: string;
		id: number;
		remote_id: number | string;
	}): Promise<Result<Object>>;

	protected async sync(signal: AbortSignal): Promise<void> {
		if (signal.aborted) {
			return;
		}
		for (const table of this.syncedTables) {
			this.manager.scheduleTaskRun('syncTable', table);
		}
	}

	private static mergeItems(
		remoteItem: PullItem,
		localItem: Object | undefined,
	): Object | PullItem {
		if (!localItem) return remoteItem;
		return {
			...localItem,
			...remoteItem,
		};
	}
	private static determineAction(
		events: WriteLogEntry[],
	): 'create' | 'update' | 'delete' {
		if (events.some((e) => e.method === 'delete')) {
			return 'delete';
		}
		if (events.some((e) => e.method === 'create')) {
			return 'create';
		}
		return 'update';
	}

	protected async syncTable(table: keyof typeof this.db) {
		const localTable = this.db[table] as Dexie.Table<unknown, string | number>;

		const remoteData = await this.pullData({ table });

		if (remoteData.error) {
			return;
		}
		const writeLogPromise = this.db._writeLog
			.where('table')
			.equals(table)
			.toArray();

		// only read from database if there is remote data
		const localRemotePromise =
			remoteData.data.length > 0
				? (localTable
						.where('remote_id')
						.anyOf(remoteData.data.map((item) => item.remote_id))
						.toArray() as Promise<Object[]>)
				: Promise.resolve([]);

		const [localRemoteItems, writeLog] = await Promise.all([
			localRemotePromise,
			writeLogPromise,
		]);

		// No updates for anyone
		if (remoteData.data.length === 0 && writeLog.length === 0) {
			return;
		}

		//TODO increase merge performance through hashing
		if (writeLog.length === 0) {
			//merge remote data with the local data if there is a local data
			let mergedData = [];
			for (const remoteItem of remoteData.data) {
				const localItem = localRemoteItems.find(
					(item) => item.remote_id === remoteItem.remote_id,
				);
				mergedData.push(SyncBase.mergeItems(remoteItem, localItem));
			}
			await this.db.transaction('rw', localTable, async () => {
				await localTable.bulkPut(mergedData);
			});
			return;
		}

		const objectWrites = new Map<number, WriteLogEntry[]>();
		for (const entry of writeLog) {
			if (entry.table !== table) continue;
			if (!objectWrites.has(entry.object_id)) {
				objectWrites.set(entry.object_id, [entry]);
			}
			objectWrites.get(entry.object_id)?.push(entry);
		}
		const localWriteItems = localTable
			.where('id')
			.anyOf(Array.from(objectWrites.keys()))
			.toArray() as Promise<Object[]>;
		// TODO Test materialize vs loading the ids and then pushing
		if (remoteData.data.length === 0) {
			const pushPromises = [];
			for (const item of await localWriteItems) {
				const action = SyncBase.determineAction(
					objectWrites.get(item.id) as WriteLogEntry[],
				);
				switch (action) {
					case 'create': {
						pushPromises.push(this.pushCreate({ table, data: item }));
						break;
					}
					case 'update': {
						pushPromises.push(this.pushUpdate({ table, data: item }));
						break;
					}
					case 'delete': {
						pushPromises.push(
							this.pushDelete({
								table,
								id: item.id,
								remote_id: item.remote_id,
							}),
						);
						break;
					}
				}
			}
			const responses = await Promise.allSettled(pushPromises);
		}
	}
}
