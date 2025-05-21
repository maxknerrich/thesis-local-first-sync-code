import { type } from 'arktype';

export const User = type({
	'id?': 'number.integer',
	name: 'string',
	login: 'string',
	avatar_url: 'string.url',
});

export const Status = type('0|1|2|3');

export const StatusLabels: Record<number, string> = {
	0: 'Todo',
	1: 'In Progress',
	2: 'Done',
	3: 'Backlog',
};

export const Priority = type('0|1|2');
export const PriorityLabels: Record<number, string> = {
	0: 'Low',
	1: 'Medium',
	2: 'High',
};

export const Issue = type({
	'id?': 'number.integer',
	title: 'string',
	'description?': 'string',
	status: Status,
	priority: Priority,
	github_number: 'number.integer',
	// user: User,
	'assignee?': type(User, '[]'),
	created_at: 'Date',
	updated_at: 'Date',
	project_id: 'number.integer',
});

export const Project = type({
	'id?': 'number.integer',
	name: 'string',
	full_name: 'string',
	created_at: 'Date',
	updated_at: 'Date',
	owner: User,
});

export const Comment = type({
	'id?': 'number.integer',
	issue_id: 'number.integer',
	github_id: 'number.integer',
	body: 'string',
	created_at: 'Date',
	updated_at: 'Date',
	user: User,
});

export type Status = typeof Status.infer;
export type Priority = typeof Priority.infer;
export type Issue = typeof Issue.infer;
export type User = typeof User.infer;
export type Project = typeof Project.infer;
export type Comment = typeof Comment.infer;
