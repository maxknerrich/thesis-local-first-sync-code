import { type } from 'arktype';

const WriteLogEntry = type({
	number: 'number.integer',
	object_id: 'string',
	table: 'string',
	method: "'create' | 'update' | 'delete'",
	old_data: 'object',
	new_data: 'object',
});
export type WriteLogEntry = typeof WriteLogEntry.infer;
