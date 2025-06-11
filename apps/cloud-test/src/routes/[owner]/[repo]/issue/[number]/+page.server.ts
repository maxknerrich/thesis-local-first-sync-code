import { error, fail, redirect } from '@sveltejs/kit';
import { fetchIssue, updateIssue } from '$lib/server/github.js';

export const load = async ({ params }) => {
	const { owner, repo, number } = params;

	try {
		const issue = await fetchIssue(owner, repo, parseInt(number));
		if (!issue) {
			throw error(404, 'Issue not found');
		}
		return { issue };
	} catch (err) {
		console.error('Failed to load issue:', err);
		throw error(500, 'Failed to load issue');
	}
};

export const actions = {
	updateIssue: async ({ request, params }) => {
		const { owner, repo, number } = params;
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
			await updateIssue(owner, repo, parseInt(number), {
				title: title.trim(),
				body: body?.trim() || undefined,
				state
			});
		} catch (err) {
			console.error('Failed to update issue:', err);
			return fail(500, { 
				error: 'Failed to update issue',
				title,
				body,
				state
			});
		}

		throw redirect(303, `/${owner}/${repo}`);
	}
};
