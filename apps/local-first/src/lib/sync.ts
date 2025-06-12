import { PUBLIC_GITHUB_TOKEN } from '$env/static/public';
import { db } from '$lib/db';
import type { Issue, Repository } from '$lib/schema';
import { GitHubSync } from '$lib/x-sync';
import type Dexie from 'dexie';

type Schema = {
	issues: Required<Issue> & { remote_id: string };
	repos: Required<Repository> & { remote_id: string };
};

export const sync = new GitHubSync<Schema, typeof db>({
	db,
	token: PUBLIC_GITHUB_TOKEN,
	syncConfig: {
		issues: {
			mode: 'auto',
			syncInterval: 60,
			path: 'rw',
		},
		repositories: {
			mode: 'manual',
			path: 'r',
		},
	},
	schema: {
		issues: {
			tableName: 'issues',
			initialData: {
				priority: 1,
			},
			repos_to_fetch: () =>
				db.repositories
					.filter((repo) => repo.project_id !== undefined)
					.toArray()
					.then((repos) => {
						return repos.map((repo) => ({
							full_name: repo.full_name,
							id: repo.project_id as number,
						}));
					}),
			getRepo: (issue) =>
				db.projects
					.get(issue.project_id)
					.then((repo) => db.repositories.get(repo?.repository_id ?? 0))
					.then((repo) => repo?.full_name ?? ''),
			//@ts-ignore
			toLocal: (remote, args?: { full_name: string; id: number }) => ({
				title: remote.title,
				description: remote.body,
				status: remote.state === 'open' ? 0 : 2,
				github_number: remote.number,
				remote_id: String(remote.id),
				//@ts-ignore
				project_id: args.id,
			}),
			toRemote: (
				local,
			): Partial<{ title: string; body: string; state: string }> => {
				const remoteDelta: Partial<{
					title: string;
					body: string;
					state: string;
				}> = {};
				if (local.title) {
					remoteDelta.title = local.title;
				}
				if (local.description) {
					remoteDelta.body = local.description;
				}
				if (local.status !== undefined) {
					remoteDelta.state = local.status === 2 ? 'closed' : 'open';
				}
				return remoteDelta;
			},
		},
		// @ts-ignore
		repos: {
			tableName: 'repositories' as keyof Dexie,
			toLocal: (remote) =>
				({
					name: remote.name,
					description: remote.description ? remote.description : '',
					remote_id: remote.id.toString(),
					full_name: remote.full_name,
				}) as Required<Repository> & { remote_id: string },
		},
	},
});
