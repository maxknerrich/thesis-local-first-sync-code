import { PUBLIC_GITHUB_TOKEN } from '$env/static/public';
import { db } from '$lib/db';
import type { paths } from '$lib/githubapi';
import type * as Schema from '$lib/schema';

import { type TDateISO, validateISO861Date } from '$lib/types/date';
import { paginatedFetch, safeFetch } from '$lib/utils';
import type { type } from 'arktype';

const BASIC_HEADERS = {
	Accept: 'application/vnd.github.text+json',
	Authorization: `Bearer ${PUBLIC_GITHUB_TOKEN}`,
	'X-GitHub-Api-Version': '2022-11-28',
};

export type schema = {
	issue: Schema.Issue;
	project: Schema.Project;
};

export type GH_Schema = {
	issue: paths['/repos/{owner}/{repo}/issues']['get']['responses']['200']['content']['application/json'][number];
	repo: paths['/repos/{owner}/{repo}/projects']['get']['responses']['200']['content']['application/json'][number];
};

// What is the better API? GH.issue.push (API.SCHEMA.ACTION) vs GH.pull.issue (API.ACTION.SCHEMA)
interface GH_API<T> {
	pull: {
		[key in keyof T]: () => Promise<Partial<T[key]>>;
	};
	push: {
		[key: string]: {
			create: (
				data: typeof db.Collection,
			) => Promise<{ data: object; status: number }>;
			update: (
				data: typeof db.Collection,
			) => Promise<{ data: object; status: number }>;
			delete: (
				data: typeof db.Collection,
			) => Promise<{ data: object; status: number }>;
		};
	};
}

const moine: GH_API<schema> = {
	pull: {
		issue: async () => {
			return { title: 'Pull' };
		},
		project: async () => {
			return { name: 'Pull' };
		},
	},
	push: {
		issue: {
			create: async (data) => {
				return { data, status: 201 };
			},
			update: async (data) => {
				return { data, status: 200 };
			},
			delete: async (data) => {
				return { data, status: 204 };
			},
		},
		project: {
			create: async (data) => {
				return { data, status: 201 };
			},
			update: async (data) => {
				return { data, status: 200 };
			},
			delete: async (data) => {
				return { data, status: 204 };
			},
		},
	},
};

export const GH_API = {
	query: {
		get_all_repos: async () => {
			const { data, error } = await paginatedFetch<
				paths['/users/{username}/repos']['get']['responses']['200']['content']['application/json']
			>(`https://api.github.com/user/repos`, {
				headers: BASIC_HEADERS,
			});
			if (error) {
				return { data: null, error };
			}
			return { data, error: null };
		},
		get_issues: async ({
			user,
			repo,
			since = null,
		}: {
			user: string;
			repo: string;
			since?: TDateISO | null;
		}) => {
			if (since && !validateISO861Date(since)) {
				return { data: null, error: 'Invalid date format' };
			}
			const { data, error } = await paginatedFetch<
				paths['/repos/{owner}/{repo}/issues']['get']['responses']['200']['content']['application/json']
			>(`https://api.github.com/repos/${user}/${repo}/issues`, {
				headers: since ? { ...BASIC_HEADERS, since } : BASIC_HEADERS,
			});
			if (error) {
				return { data: null, error };
			}
			return { data, error: null };
		},
	},
	push: {
		issue: {
			create: async ({
				title,
				body,
				repo,
				owner,
			}: {
				title: string;
				body: string;
				repo: string;
				owner: string;
			}) => {
				const { data, error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
				>(`https://api.github.com/repos/${owner}/${repo}/issues`, {
					method: 'POST',
					headers: BASIC_HEADERS,
					body: JSON.stringify({
						title,
						body,
					}),
				});
				if (error) {
					return { data: null, error };
				}
				return { data, error: null };
			},
			update: async ({
				issue_number,
				repo,
				owner,
				title,
				body,
			}: {
				issue_number: number;
				repo: string;
				owner: string;
				title?: string;
				body?: string;
			}) => {
				const { data, error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues/{issue_number}']['patch']['responses']['200']['content']['application/json']
				>(
					`https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`,
					{
						method: 'PATCH',
						headers: BASIC_HEADERS,
						body: JSON.stringify({
							title,
							body,
						}),
					},
				);
				if (error) {
					return { data: null, error };
				}
				return { data, error: null };
			},
		},
	},
};
