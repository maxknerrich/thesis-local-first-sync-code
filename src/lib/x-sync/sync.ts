import type Dexie from 'dexie';
import { createManager, type Manager } from 'tinytick';
import type { Mapper } from './mapper';

interface OfflineError {
	type: 'offline';
	error: Error;
}
interface AbortError {
	type: 'aborted';
	error: Error;
}

type SyncError = OfflineError | AbortError;

type Result =
	| {
			success: null;
			error: SyncError;
	  }
	| {
			success: true;
			error: null;
	  };

const states = {
	connection: {
		offline: { next: 'online' },
		online: { next: 'offline' },
	},
	sync: {
		idle: { next: 'syncing' },
		syncing: { next: 'synced' },
		synced: { next: 'syncing' },
	},
};

type ConnectionState = keyof typeof states.connection;
type SyncState = keyof typeof states.sync;

/**
 * Sync Manager Class to sync to remote API
 * @param {Object} options - Options for the sync manager
 * @param {number} options.syncInterval - Interval for syncing in s (default: 300s (5min))
 * @param {Dexie} options.db - Dexie database instance
 * @param {object} options.mapper - Mapper object for syncing
 * @example const sync = new XSync({ db, mapper, syncInterval: 300 });
 */
export class XSync {
	private readonly manager: Manager;
	private readonly sync_interval: number;
	private readonly db: Dexie;
	private readonly mapper: Mapper<Dexie>;
	sync_state: SyncState = 'idle';
	online_state: ConnectionState;

	constructor({
		sync_interval: syncInterval = 300,
		db,
		mapper,
	}: { sync_interval?: number; db: Dexie; mapper: Mapper<Dexie> }) {
		if (!navigator || !window) {
			throw new Error('Not running in a browser or navigator is not available');
		}
		this.db = db;
		this.mapper = mapper;
		this.manager = createManager();
		this.sync_interval = syncInterval * 1000; // convert to ms

		window.addEventListener('online', this.handleOnline.bind(this));
		window.addEventListener('offline', this.handleOffline.bind(this));

		this.manager.setTask(
			'sync',
			async (_, signal) => this.sync(signal),
			'syncHandler',
			{
				maxDuration: 30 * 1000,
				retryDelay: this.sync_interval,
				repeatDelay: this.sync_interval,
			},
		);

		if (!navigator.onLine) {
			this.online_state = 'offline';
			this.manager.stop();
			return;
		}
		this.online_state = 'online';
		this.manager.start();
	}

	// Separate methods for handling events
	private handleOnline(_event: Event): void {
		this.online_state = states.connection[this.online_state]
			.next as ConnectionState;
		this.manager.start();
	}

	private handleOffline(_event: Event): void {
		this.online_state = states.connection[this.online_state]
			.next as ConnectionState;
		this.manager.stop(true);
	}

	/**
	 * Cleanup event listeners on destruction
	 */
	destroy() {
		window.removeEventListener('online', this.handleOnline);
		window.removeEventListener('offline', this.handleOffline);
		this.manager.stop(true);
	}
	/**
	 * Sync method to sync to remote API
	 */
	async sync(signal: AbortSignal) {
		if (signal.aborted) {
			return;
		}
		if (this.online_state === 'offline') {
			return;
		}
		if (this.sync_state === 'syncing') {
			return;
		}
		this.sync_state = states.sync[this.sync_state].next as SyncState;
		this.manager.setTask;
	}

	static getInitialState({
		db,
		table,
		object_id,
	}: {
		db: Dexie;
		table: string;
		object_id: number;
	}) {}
}
