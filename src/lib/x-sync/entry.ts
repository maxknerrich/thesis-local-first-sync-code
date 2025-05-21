import { type } from 'arktype';

const WriteLogEntry = type({
	number: 'number.integer',
	object_id: 'string',
	table: 'string',
	method: "'create' | 'update' | 'delete'",
	old_data: 'object | null',
	new_data: 'object | null',
});
export type WriteLogEntry = typeof WriteLogEntry.infer;
