/**
 * Dexie database extension for X-Sync Addon
 * @author: Max Knerrich
 * @description: This module extends the Dexie database to include a _writeLog table for logging changes made to other tables.
 */
import { Dexie, type EntityTable } from 'dexie';
import type { WriteLogEntry } from './entry';

// Extend the Dexie database interface to include _writeLog table
declare module 'dexie' {
	interface Dexie {
		_writeLog: EntityTable<WriteLogEntry, 'number'>;
	}
}

export function X_Sync_Addon_Dexie(db: Dexie) {
	/**
	 * Override the Dexie.version([version]).store method to add the _writeLog table.
	 */
	db.Version.prototype.stores = Dexie.override(
		db.Version.prototype.stores,
		(originalStores) =>
			function (this: unknown, stores: { [key: string]: string }) {
				// Add the _writeLog table to the stores object or override it if it exists
				stores._writeLog = '++number, [object_id+table], operation';
				// Call the original stores function with the modified schema
				return originalStores.call(this, stores);
			},
	);

	/**
	 * Override the Dexie.[table].add method to log changes to the _writeLog table.
	 */
	db.Table.prototype.add = Dexie.override(
		db.Table.prototype.add,
		(original) =>
			async function (this: Dexie.Table, ...args: unknown[]) {
				// If the table is _writeLog, call the original method
				if (this.name === '_writeLog') {
					return original.apply(this, args);
				}
				const result = db.transaction('rw', [db._writeLog, this], async () => {
					const result = await original.apply(this, args);
					await db._writeLog.add({
						object_id: result,
						table: this.name,
						method: 'create',
						old_data: null,
						new_data: args[0] as object,
					});
					return result;
				});
				return result;
			},
	);

	/**
	 * Override the Dexie.[table].put method to log changes to the _writeLog table.
	 */
	db.Table.prototype.put = Dexie.override(
		db.Table.prototype.put,
		(original) =>
			async function (this: Dexie.Table, ...args: unknown[]) {
				// If the table is _writeLog, call the original method
				if (this.name === '_writeLog') {
					return original.apply(this, args);
				}
				const result = db.transaction('rw', [db._writeLog, this], async () => {
					const result = await original.apply(this, args);
					await db._writeLog.add({
						object_id: result,
						table: this.name,
						method: 'update',
						old_data: args[0] as object,
						new_data: args[1] as object,
					});
					return result;
				});
				return result;
			},
	);

	/**
	 * Override the Dexie.[table].delete method to log changes to the _writeLog table.
	 */
	db.Table.prototype.delete = Dexie.override(
		db.Table.prototype.delete,
		(original) =>
			async function (this: Dexie.Table, ...args: unknown[]) {
				// If the table is _writeLog, call the original method
				if (this.name === '_writeLog') {
					return original.apply(this, args);
				}
				const result = db.transaction('rw', [db._writeLog, this], async () => {
					const result = await original.apply(this, args);
					await db._writeLog.add({
						object_id: args[0] as string,
						table: this.name,
						method: 'delete',
						old_data: args[0] as object,
						new_data: null,
					});
					return result;
				});
				return result;
			},
	);
}
