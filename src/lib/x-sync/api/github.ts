import { paginatedFetch, safeFetch } from '$lib/utils';
import { SyncBase } from '$lib/x-sync/sync';
import type Dexie from 'dexie';
import type {
	DBObject,
	PullItem,
	PullResult,
	Result,
	syncConfig,
} from '../types';
import type { paths } from './githubapi';

type RemoteIssue =
	paths['/repos/{owner}/{repo}/issues']['get']['responses']['200']['content']['application/json'][number];
type RemoteRepo =
	paths['/users/{username}/repos']['get']['responses']['200']['content']['application/json'][number];

export type GitHubSchemaDefinition = {
	issues: { github_number: number } & DBObject;
	repos: DBObject;
};

export type SchemaConfig<
	TSchema extends GitHubSchemaDefinition,
	TDB extends Dexie,
> = {
	[K in keyof TSchema]: {
		tableName: keyof TDB | K;
		toLocal: <S>(
			remote: K extends 'issues' ? RemoteIssue : RemoteRepo,
			callbacks?: S,
		) => TSchema[K];
		toRemote: (
			local: TSchema[K],
		) => K extends 'issues' ? Partial<RemoteIssue> : Partial<RemoteRepo>;
	} & (K extends 'issues'
		? {
				repos_to_fetch: () => Promise<{ full_name: string; id: number }[]>;
				getRepo: (issue: TSchema['issues']) => Promise<string>;
			}
		: Record<string, never>);
};

export class GitHubSync<
	TSchema extends GitHubSchemaDefinition,
	TDB extends Dexie,
> extends SyncBase<TDB> {
	private headers: Record<string, string>;
	private schema: SchemaConfig<TSchema, Dexie>;
	constructor({
		db,
		token,
		syncConfig,
		schema,
	}: {
		db: TDB;
		token: string;
		syncConfig?: syncConfig;
		schema: SchemaConfig<TSchema, Dexie>;
	}) {
		super({ db, ...(syncConfig && { syncConfig }) });
		this.schema = schema;
		this.headers = {
			Accept: 'application/vnd.github.text+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
		};
	}
	async pullData({
		table,
		since,
	}: {
		table: string;
		since?: Date;
	}): Promise<Result<PullResult>> {
		switch (table) {
			case this.schema.issues.tableName: {
				const repos = await this.schema.issues.repos_to_fetch();
				const issues = await Promise.all(
					repos.map((repo) =>
						this.get_issues({
							fullname: repo.full_name,
							since: since,
						}).then((res) => {
							return res.map((issue: RemoteIssue) =>
								this.schema.issues.toLocal<typeof repo>(issue, repo),
							);
						}),
					),
				).then((results) => results.flat());
				return { error: null, data: issues as PullItem[] };
			}
			case this.schema.repos.tableName: {
				const data = await paginatedFetch<
					paths['/users/{username}/repos']['get']['responses']['200']['content']['application/json']
				>(
					`https://api.github.com/user/repos${since ? `?since=${since.toISOString()}` : ''}`,
					{
						headers: this.headers,
					},
				).then((res) => {
					return (
						res.data?.map((repo: RemoteRepo) =>
							this.schema.repos.toLocal(repo),
						) || []
					);
				});
				if (!data) {
					throw new Error('Failed to fetch repos from GitHub');
				}
				return { data: data as PullItem[], error: null };
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
			case this.schema.issues.tableName: {
				const repo = await this.schema.issues.getRepo(
					item as TSchema['issues'],
				);
				const { data: pullData, error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
				>(`https://api.github.com/repos/${repo}/issues`, {
					method: 'POST',
					headers: this.headers,
					body: JSON.stringify(
						this.schema.issues.toRemote(data as TSchema['issues']),
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
			case this.schema.issues.tableName: {
				const remoteData = this.schema.issues.toRemote(
					data as TSchema['issues'],
				);
				if (!remoteData) {
					//nothing to update
					return;
				}
				const repo = await this.schema.issues.getRepo(
					item as TSchema['issues'],
				);
				const number = item.github_number;

				const { error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
				>(`https://api.github.com/repos/${repo}/issues/${number}`, {
					method: 'PATCH',
					headers: this.headers,
					body: JSON.stringify(remoteData),
				});
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
		const queryParams = since
			? `?since=${since.toISOString()}&state=all`
			: '?state=all';
		const { data, error } = await paginatedFetch<
			paths['/repos/{owner}/{repo}/issues']['get']['responses']['200']['content']['application/json']
		>(`https://api.github.com/repos/${fullname}/issues${queryParams}`, {
			headers: this.headers,
		});
		if (error) {
			throw new Error(`Failed to fetch issues: ${error}`);
		}
		return data;
	}
}
