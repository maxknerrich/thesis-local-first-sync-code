import type Dexie from 'dexie';
import { db, type Tables } from './db';
import { GH_API } from './github';
import type { paths } from './githubapi';
import { Issue, Project } from './schema';
import type { Mapper } from './x-sync/mapper';

type GH_Issue =
	paths['/repos/{owner}/{repo}/issues']['get']['responses']['200']['content']['application/json'][number];
type GH_Repo =
	paths['/repos/{owner}/{repo}']['get']['responses']['200']['content']['application/json'];

export const mapper: Mapper<typeof db> = {
	to_local: {
		issue: async (issue: GH_Issue): Promise<ToLocalEntry<Partial<Issue>>> => ({
			meta: {
				remote_id: issue.id,
				created_at: new Date(issue.created_at),
				updated_at: new Date(issue.updated_at),
			},
			data: {
				title: issue.title,
				description: issue.body || '',
				status: issue.state === 'open' ? 0 : 2,
				github_number: issue.number,
				project_id: await db.projects
					.where('full_name')
					.equals(issue.repository?.full_name)
					.first()
					.then((projects) => projects?.id || 0),
			},
		}),
		project: (repo: GH_Repo) => ({
			meta: {
				remote_id: repo.id,
				created_at: new Date(repo.created_at),
				updated_at: new Date(repo.updated_at),
			},
			data: {
				created_at: new Date(repo.created_at),
				updated_at: new Date(repo.updated_at),
				name: repo.name,
				full_name: repo.full_name,
			},
		}),
	},
	to_remote: {
		issue: (issue: Issue): Partial<GH_Issue> => ({
			title: issue.title,
			body: issue.description || '',
			state: issue.status === 0 ? 'closed' : 'open',
		}),
	},
	api: {
		issues: {
			create: async (data) => {
				const project = await db.projects
					.where('id')
					.equals(data.project_id)
					.first();
				const create = await GH_API.push.issue.create({
					body: data.description,
					title: data.title,
					owner: project?.full_name.split('/')[0] || '',
					repo: project?.full_name.split('/')[1] || '',
				});
				return create;
			},
			update:
				GH_API.push.issue.update ||
				(async (data) => {
					// Implementation for updating an issue
					// You should replace this with the actual implementation if available
					console.warn(
						'Issue update method called but not fully implemented',
						data,
					);
					return Promise.resolve({ data: null, error: null });
				}),
			delete: () => {
				return Promise.resolve({ data: 'no remote delete', error: null });
			},
		},
	},
};
