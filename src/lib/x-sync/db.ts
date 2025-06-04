/**
 * Dexie database extension for X-Sync Addon
 * @author: Max Knerrich
 * @description: This module extends the Dexie database to include a _writeLog table for logging changes made to other tables.
 */

import { Dexie, type EntityTable } from 'dexie';
import type { WriteLogEntry } from './entry';
import { diffObject } from './utils';

interface SyncFields {
	remote_id: number;
	remote_created_at: Date;
	remote_updated_at: Date;
}

export type SyncStore<T, id extends keyof T> = EntityTable<T & SyncFields, id>;

// Extend the Dexie database interface to include _writeLog table
declare module 'dexie' {
	interface Dexie {
		_writeLog: EntityTable<WriteLogEntry, 'number'>;
		_syncedStores: string[];
	}
	interface Version {
		/**
		 * Override the stores method to add the _writeLog table and sync fields to the stores.
		 * @param stores - The stores to be added to the version.
		 * @param syncConfig.sync - An array of store names that should be synced.
		 * @example
		 * db.version(1).stores(
		 * 	{ issues: '++id, title, description, status, priority, github_number, project_id'},
		 * 	{ sync: ['issues'] }
		 * );
		 */
		stores<T extends { [key: string]: string }>(
			this: Version,
			stores: T,
			syncConfig?: { sync: Array<keyof T> },
		): Version;
	}
}

// Add the remote_id index to synced tables
export function make_sync_store(indexes: string) {
	return `${indexes}, remote_id`;
}
export function X_Sync_Addon_Dexie(db: Dexie) {
	db._syncedStores = [];
	/**
	 * Override the Dexie.version([version]).store method to add the _writeLog table.
	 */
	db.Version.prototype.stores = Dexie.override(
		db.Version.prototype.stores,
		(originalStores) =>
			function <T extends { [key: string]: string }>(
				this: unknown,
				stores: T,
				syncConfig?: { sync: Array<keyof T> },
			) {
				// skip if no stores are defined or if no store is a synced store
				if (!stores || !syncConfig || syncConfig.sync.length === 0) {
					return originalStores.call(this, stores);
				}
				syncConfig.sync.forEach((store) => {
					// check if store is already in db.syncedStores
					if (db._syncedStores.includes(store.toString())) {
						return;
					}
					// check if store is already in stores
					if (stores[store]) {
						db._syncedStores.push(store.toString());
						stores[store] = make_sync_store(stores[store]) as T[keyof T];
					}
				});
				// Add the _writeLog table to the stores object or override it if it exists
				(stores as Record<string, string>)['_writeLog'] =
					'++number, [object_id+table], table';
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
				// check if table has index remote_id and if not, call the original method
				const isSyncedStore = db._syncedStores.includes(this.name);
				if (!isSyncedStore) {
					return original.apply(this, args);
				}
				const result = db.transaction(
					'rw',
					['_writeLog', this.name],
					async () => {
						const result = await original.apply(this, args);
						await db._writeLog.add({
							object_id: result,
							table: this.name,
							method: 'create',
							old_data: null,
							new_data: args[0] as object,
						});
						return result;
					},
				);
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
				const isSyncedStore = db._syncedStores.includes(this.name);
				if (!isSyncedStore) {
					return original.apply(this, args);
				}
				const result = db.transaction(
					'rw',
					['_writeLog', this.name],
					async () => {
						const result = await original.apply(this, args);
						await db._writeLog.add({
							object_id: result,
							table: this.name,
							method: 'update',
							old_data: args[0] as object,
							new_data: args[1] as object,
						});
						return result;
					},
				);
				return result;
			},
	);

	db.Table.prototype.update = Dexie.override(
		db.Table.prototype.update,
		(original) =>
			async function (this: Dexie.Table, ...args: unknown[]) {
				// If the table is _writeLog, call the original method
				if (this.name === '_writeLog') {
					return original.apply(this, args);
				}
				const isSyncedStore = db._syncedStores.includes(this.name);
				if (!isSyncedStore) {
					return original.apply(this, args);
				}
				const result = db.transaction(
					'rw',
					['_writeLog', this.name],
					async () => {
						let oldData = {} as Record<string, unknown>;
						const result = await this.where('id')
							.equals(args[0] as number)
							.modify((value, ref) => {
								Object.keys(args[1] as object).forEach((key) => {
									if (Object.hasOwn(value, key)) {
										oldData[key] = value[key];
									}
								});
								ref.value = Object.assign(value, args[1]);
							});
						// object.modify(args[1] as object);
						await db._writeLog.add({
							object_id: args[0] as number,
							table: this.name,
							method: 'update',
							old_data: oldData,
							new_data: args[1] as object,
						});
						return result;
					},
				);
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
				const isSyncedStore = db._syncedStores.includes(this.name);
				if (!isSyncedStore) {
					return original.apply(this, args);
				}
				const result = db.transaction(
					'rw',
					['_writeLog', this.name],
					async () => {
						let oldData = {} as Record<string, unknown>;
						const result = await this.where('id')
							.equals(args[0] as number)
							.modify((value, ref) => {
								oldData = value;
								delete ref.value;
							});
						await db._writeLog.add({
							object_id: args[0] as number,
							table: this.name,
							method: 'delete',
							old_data: oldData,
							new_data: null,
						});
						return result;
					},
				);
				return result;
			},
	);
}
