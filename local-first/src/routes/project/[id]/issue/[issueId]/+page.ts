import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const projectId = parseInt(params.id);
	const issueId = parseInt(params.issueId);
	return {
		projectId,
		issueId
	};
};
