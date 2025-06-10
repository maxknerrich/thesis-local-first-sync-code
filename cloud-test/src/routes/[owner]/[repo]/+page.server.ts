import { error, fail, redirect } from '@sveltejs/kit';
import { fetchRepositoryIssues, createIssue } from '$lib/server/github.js';

export const load = async ({ params, parent }) => {
	const parentData = await parent();
	const { owner, repo } = params;
	
	// Find the repository in the user's repositories
	const selectedRepository = parentData.repositories.find(
		(r: any) => r.owner.login === owner && r.name === repo
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
	createIssue: async ({ request, params }) => {
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
			await createIssue(owner, repo, {
				title: title.trim(),
				body: body?.trim() || undefined,
				state
			});

			// Redirect back to the repository page to refresh the issues list
			throw redirect(303, `/${owner}/${repo}`);
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
