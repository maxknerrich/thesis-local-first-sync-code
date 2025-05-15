import { Schema } from 'effect';

export const Status = Schema.Literal(0, 1, 2, 3).annotations({
	title: 'Status',
});

export const StatusLabels: Record<number, string> = {
	0: 'Todo',
	1: 'In Progress',
	2: 'Done',
	3: 'Backlog',
};

export const Priority = Schema.Literal(0, 1, 2).annotations({
	title: 'Priority',
});
export const PriorityLabels: Record<number, string> = {
	0: 'Low',
	1: 'Medium',
	2: 'High',
};

const Integer = Schema.Number.pipe(Schema.int()).annotations({
	title: 'Integer',
});

export const User = Schema.Struct({
	id: Integer,
	name: Schema.String,
	login: Schema.String,
	avatar_url: Schema.URL,
});

export const Issue = Schema.Struct({
	id: Integer,
	title: Schema.String,
	description: Schema.String,
	status: Status,
	priority: Priority,
	github_number: Integer,
	user: User,
	assignee: Schema.optional(Schema.Array(User)),
	created_at: Schema.Date,
	updated_at: Schema.Date,
	project_id: Integer,
});

export const Project = Schema.Struct({
	id: Integer,
	name: Schema.String,
	full_name: Schema.String,
	created_at: Schema.Date,
	updated_at: Schema.Date,
	owner: User,
});

export const Comment = Schema.Struct({
	id: Integer,
	issue_id: Integer,
	github_id: Integer,
	body: Schema.String,
	created_at: Schema.Date,
	updated_at: Schema.Date,
	user: User,
});

export type Status = typeof Status.Type;
export type Priority = typeof Priority.Type;
export type Issue = typeof Issue.Type;
export type User = typeof User.Type;
export type Project = typeof Project.Type;
export type Comment = typeof Comment.Type;
