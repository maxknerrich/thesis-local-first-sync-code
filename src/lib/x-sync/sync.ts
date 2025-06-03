import type Dexie from 'dexie';
import { createManager, type Manager } from 'tinytick';
import type { WriteLogEntry } from './entry';

export type Result<T> =
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

export type PullResult = PullItem[];

type TableMetadata =
	| {
			lastSync: 'never';
			status: 'idle';
	  }
	| { lastSync: Date; status: 'syncing' | 'synced' };

interface syncConfig {
	[key: string]: {
		mode: 'manual' | 'auto';
		syncInterval?: number; // in seconds
	};
}

export abstract class SyncBase<TBD extends Dexie = Dexie> {
	protected db: TBD;
	protected syncedTables: string[];
	private readonly manager: Manager;
	private readonly default_interval = 5 * 60 * 1000;
	// private readonly listener;
	private lastSync: Map<string, TableMetadata>;
	private syncConfig?: syncConfig;
	private status: 'idle' | 'syncing' | 'synced' = 'idle';

	constructor({ db, syncConfig }: { db: TBD; syncConfig?: syncConfig }) {
		this.db = db;
		this.syncedTables = db._syncedStores;
		this.manager = createManager();
		if (syncConfig) {
			Object.keys(syncConfig).forEach((table) => {
				if (!this.syncedTables.includes(table)) {
					throw new Error(
						`Table ${table} is not a synced table in the database.`,
					);
				}
			});
			this.syncConfig = syncConfig;
		}
		this.manager.setTask(
			'sync',
			async (_, signal) => this.sync(signal),
			'syncHandler',
			// {
			// 	maxDuration: 30 * 1000, // 30 seconds
			// 	retryDelay: this.sync_interval,
			// 	repeatDelay: this.sync_interval,
			// },
		);
		this.manager.setTask(
			'syncTable',
			async (table) => this.syncTable(table as keyof typeof this.db),
			'syncHandler',
		);
		// this.listener = this.manager.addRunningTaskRunIdsListener((manager) => {
		// 	if (manager.getRunningTaskRunIds().length > 0) {
		// 		this.status = 'syncing';
		// 		return;
		// 	}
		// 	this.status = 'synced';
		// 	this.lastSync = new Date().toISOString();
		// });
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

	abstract pullData({ table }: { table: string }): Promise<Result<PullResult>>;
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
		console.log('Starting sync process...');
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

	private static mergeItems(
		remoteItem: PullItem | Partial<PullItem>,
		localItem: Object | undefined,
	): Object | PullItem {
		if (!localItem) return remoteItem as PullItem;
		return Object.assign(localItem, remoteItem);
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

	private static calulateOldItem(item: Object, events: WriteLogEntry[]) {
		const old_data = events.reduce(
			(acc, event) => Object.assign(acc, event.old_data),
			{},
		);
		return Object.assign(item, old_data);
	}

	protected async syncTable(table: keyof TBD) {
		if (typeof table !== 'string') return;
		console.log(`Syncing table: ${table}`);
		const localTable = this.db[table] as Dexie.Table<unknown, string | number>;

		const remoteData = await this.pullData({ table });

		console.log(remoteData);

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
			console.log(`Merging remote data with local data for table: ${table}`);
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
			this.lastSync.set(table, { lastSync: new Date(), status: 'synced' });
			return;
		}
		let remoteWriteLog = new Map<string, Partial<PullItem>>();
		for (const item of remoteData.data) {
			// Item has no local writes directly apply
		}
	}
}
