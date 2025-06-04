type BaseWriteLog = {
	number: number;
	object_id: number;
	table: string;
};
export type WriteLogEntry =
	| (BaseWriteLog & {
			method: 'create';
			old_data: null;
			new_data: DBObject;
	  })
	| (BaseWriteLog & {
			method: 'update';
			old_data: DBObject;
			new_data: Partial<DBObject>;
	  })
	| (BaseWriteLog & {
			method: 'delete';
			old_data: DBObject;
			new_data: null;
	  });
export type Result<T> =
	| {
			data: T;
			error: null;
	  }
	| {
			data: null;
			error: Error;
	  };

export interface PullItem {
	remote_id: string;
	[key: string]: unknown;
}
export interface DBObject extends PullItem {
	id: number;
}

export type PullResult = PullItem[];

export type TableMetadata =
	| {
			lastSync: 'never';
			status: 'idle';
	  }
	| { lastSync: Date; status: 'syncing' | 'synced' };

export interface syncConfig {
	[key: string]: {
		mode: 'manual' | 'auto';
		syncInterval?: number; // in seconds
		path?: 'r' | 'w' | 'rw'; // read, write, or both
	};
}

export interface ConflictItem {
	localItem: DBObject;
	remoteItem: PullItem;
	writeLog: WriteLogEntry[];
}
