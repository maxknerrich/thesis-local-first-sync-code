import { PUBLIC_GITHUB_TOKEN } from '$env/static/public';
import { SyncBase } from '$lib/x-sync/sync';
import type { db } from './db';
import type { paths } from './githubapi';
import type { Issue } from './schema';
import { paginatedFetch, safeFetch } from './utils';
import type { DBObject, PullItem, PullResult, Result } from './x-sync/types';

const BASIC_HEADERS = {
	Accept: 'application/vnd.github.text+json',
	Authorization: `Bearer ${PUBLIC_GITHUB_TOKEN}`,
	'X-GitHub-Api-Version': '2022-11-28',
};

export class GitHubSync extends SyncBase<typeof db> {
	async pullData({
		table,
		since,
	}: {
		table: string;
		since?: Date;
	}): Promise<Result<PullResult>> {
		switch (table) {
			case 'issues': {
				const projects = await this.db.projects
					.filter((project) => project.active === true)
					.toArray();
				const issues = await Promise.all(
					projects.map((project) =>
						this.get_issues({
							fullname: project.full_name,
							since: since,
						}).then((res) => {
							return res.map((issue) => ({
								remote_id: issue.id.toString(),
								github_number: issue.number,
								title: issue.title,
								description: issue.body,
								status: issue.state === 'open' ? 0 : 2,
								project_id: project.id,
							}));
						}),
					),
				).then((results) => results.flat());
				return { error: null, data: issues };
			}
			case 'projects': {
				const data = await paginatedFetch<
					paths['/users/{username}/repos']['get']['responses']['200']['content']['application/json']
				>(`https://api.github.com/user/repos`, {
					headers: BASIC_HEADERS,
				}).then((res) => {
					return res.data?.map((repo) => ({
						remote_id: repo.id.toString(),
						full_name: repo.full_name,
						name: repo.name,
						description: repo.description || '',
						active: false,
					}));
				});
				if (!data) {
					throw new Error('Failed to fetch projects from GitHub');
				}
				return { data, error: null };
			}
			default:
				return { data: null, error: new Error(`Unknown table: ${table}`) };
		}
	}

	async pushCreate({
		table,
		item,
		data,
	}: {
		table: string;
		item: DBObject;
		data: Omit<DBObject, 'remote_id' | 'id'>;
	}): Promise<{ key: number; changes: Partial<PullItem> }> {
		switch (table) {
			case 'issues': {
				const project = await this.db.projects.get(
					(item as unknown as Issue).project_id,
				);
				const { data: pullData, error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
				>(`https://api.github.com/repos/${project?.full_name}/issues`, {
					method: 'POST',
					headers: BASIC_HEADERS,
					body: JSON.stringify(
						this.mapLocalToRemoteIssue(data as unknown as Issue),
					),
				});
				if (error) {
					throw new Error(`Failed to create issue: ${error}`);
				}
				return {
					key: item.id,
					changes: {
						remote_id: pullData.id.toString(),
						github_number: pullData.number,
					},
				};
			}
			default:
				throw new Error(`Unknown table: ${table}`);
		}
	}

	async pushUpdate({
		table,
		item,
		data,
	}: {
		table: string;
		data: DBObject;
		item: DBObject;
	}): Promise<void> {
		switch (table) {
			case 'issues': {
				const remoteData = this.mapLocalToRemoteIssue(data as unknown as Issue);
				if (!remoteData) {
					//nothing to update
					return;
				}
				const project = await this.db.projects.get(
					(item as unknown as Issue).project_id,
				);

				const { error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
				>(
					`https://api.github.com/repos/${project?.full_name}/issues/${(item as unknown as Issue).github_number}`,
					{
						method: 'PATCH',
						headers: BASIC_HEADERS,
						body: JSON.stringify(remoteData),
					},
				);
				if (error) {
					throw new Error(`Failed to create issue: ${error}`);
				}
				return;
			}
			default:
				throw new Error(`Unknown table: ${table}`);
		}
	}
	async pushDelete({
		table,
		item,
	}: {
		table: string;
		item: DBObject;
	}): Promise<void> {
		//Do nothing, as we don't delete issues on GitHub
		return;
	}

	private async get_issues({
		fullname,
		since = undefined,
	}: {
		fullname: string;
		since?: Date | undefined;
	}) {
		if (since && !(since instanceof Date)) {
			throw new Error('Since must be a Date object or null');
		}
		const { data, error } = await paginatedFetch<
			paths['/repos/{owner}/{repo}/issues']['get']['responses']['200']['content']['application/json']
		>(
			`https://api.github.com/repos/${fullname}/issues${since ? `?since=${since.toISOString()}` : ''}`,
			{
				headers: BASIC_HEADERS,
			},
		);
		if (error) {
			throw new Error(`Failed to fetch issues: ${error}`);
		}
		return data;
	}

	private mapLocalToRemoteIssue(
		issue: Issue,
	): Partial<
		paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
	> {
		const remoteDelta: Partial<
			paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
		> = {};
		if (issue.title) {
			remoteDelta.title = issue.title;
		}
		if (issue.description) {
			remoteDelta.body = issue.description;
		}
		if (issue.status) {
			remoteDelta.state = issue.status === 2 ? 'closed' : 'open';
		}
		return remoteDelta;
	}
}
