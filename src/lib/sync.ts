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
		console.log(BASIC_HEADERS);
		switch (table) {
			case 'issues': {
				const projects = await this.db.projects
					.toArray()
					.then((projects) => projects.map((p) => p.full_name));
				const issues = await Promise.all(
					projects.map((project) =>
						this.get_issues({
							fullname: project,
							since: since,
						}).then((res) => {
							return res.map((issue) => ({
								remote_id: issue.id.toString(),
								github_number: issue.number,
								title: issue.title,
								description: issue.body,
								status: issue.state === 'open' ? 0 : 2,
							}));
						}),
					),
				);
				return { error: null, data: issues.flat() };
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
					body: JSON.stringify(data),
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
						body: JSON.stringify(data),
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
		>(`https://api.github.com/repos/${fullname}/issues`, {
			headers: since
				? { ...BASIC_HEADERS, since: since.toISOString() }
				: BASIC_HEADERS,
		});
		if (error) {
			throw new Error(`Failed to fetch issues: ${error}`);
		}
		return data;
	}
}
