import { Dexie, type EntityTable } from 'dexie';
import type { WriteLogEntry } from './entry';

// Extend the Dexie database interface to include _writeLog table
declare module 'dexie' {
	interface Dexie {
		_writeLog: EntityTable<WriteLogEntry, 'number'>;
	}
}

export function X_Sync_Addon_Dexie(db: Dexie) {
	db.Version.prototype.stores = Dexie.override(
		db.Version.prototype.stores,
		(originalStores) =>
			function (this: unknown, stores: { [key: string]: string }) {
				// Add the _writeLog store to the schema if it doesn't exist
				if (!stores._writeLog) {
					stores._writeLog = '++number, object_id, table, operation';
				}
				// Call the original stores function with our modified schema
				return originalStores.call(this, stores);
			},
	);
}
