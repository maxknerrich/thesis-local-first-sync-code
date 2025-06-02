import type Dexie from 'dexie';
import { createManager, type Manager } from 'tinytick';

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
		this.manager.scheduleTaskRun('sync');
	}

	abstract pullData(table: string, since?: Date): Promise<Result<PullResult>>;
	abstract pushCreate(table: string, data: unknown): Promise<Result<Object>>;
	abstract pushUpdate(table: string, data: unknown): Promise<Result<Object>>;
	abstract pushDelete(table: string, id: unknown): Promise<Result<Object>>;

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

	protected async syncTable(table: keyof typeof this.db) {
		const remoteData = await this.pullData(table);

		const localTable = this.db[table] as Dexie.Table<unknown, string | number>;

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
			this.db.transaction('rw', localTable, async () => {
				await localTable.bulkPut(mergedData);
			});
			return;
		}
	}
}
