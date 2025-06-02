import { PUBLIC_GITHUB_TOKEN } from '$env/static/public';
import { type PullResult, type Result, SyncBase } from '$lib/x-sync/sync';
import type { db } from './db';
import type { paths } from './githubapi';
import { paginatedFetch } from './utils';

const BASIC_HEADERS = {
	Accept: 'application/vnd.github.text+json',
	Authorization: `Bearer ${PUBLIC_GITHUB_TOKEN}`,
	'X-GitHub-Api-Version': '2022-11-28',
};

export class GitHubSync extends SyncBase<typeof db> {
	async pullData({ table }: { table: string }): Promise<Result<PullResult>> {
		const since = this.getSince(table);
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

	private async get_issues({
		fullname,
		since = null,
	}: {
		fullname: string;
		since?: Date | null;
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
