import { fetchUserRepositories } from '$lib/server/github.js';

export const load = async () => {
	try {
		const repositories = await fetchUserRepositories();
		return {
			repositories
		};
	} catch (error) {
		console.error('Failed to load repositories:', error);
		return {
			repositories: [],
			error: 'Failed to load repositories'
		};
	}
};
