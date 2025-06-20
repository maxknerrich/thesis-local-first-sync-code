import { createIssue, fetchRepositoryIssues } from '$lib/server/github.js';
import type { Repository } from '$lib/types.js';
import { error, fail, redirect } from '@sveltejs/kit';

export const load = async ({ params, parent }) => {
	const parentData = await parent();
	const { owner, repo } = params;

	// Find the repository in the user's repositories
	const selectedRepository = parentData.repositories.find(
		(r: Repository) => r.owner.login === owner && r.name === repo
	);

	if (!selectedRepository) {
		throw error(404, 'Repository not found or not accessible');
	}

	try {
		const issues = await fetchRepositoryIssues(owner, repo);
		return {
			issues,
			selectedRepository
		};
	} catch (err) {
		console.error('Failed to load issues:', err);
		return {
			issues: [],
			selectedRepository,
			error: 'Failed to load issues'
		};
	}
};

export const actions = {
	createIssue: async ({ request, params, url }) => {
		const { owner, repo } = params;
		const data = await request.formData();
		const title = data.get('title') as string;
		const body = data.get('body') as string;
		const state = data.get('state') as 'open' | 'closed';


		if (!title?.trim()) {
			return fail(400, {
				error: 'Title is required',
				title,
				body,
				state
			});
		}

		try {

			const newIssue = await createIssue(owner, repo, {
				title: title.trim(),
				body: body?.trim() || undefined,
				state
			});

			// Return the newly created issue so we can update the UI optimistically
			return { success: true, issue: newIssue };
		} catch (error) {
			console.error('Failed to create issue:', error);
			return fail(500, {
				error: 'Failed to create issue',
				title,
				body,
				state
			});
		}
	}
};
