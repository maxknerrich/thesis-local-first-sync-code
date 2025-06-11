import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const id = parseInt(params.id, 10);
	
	if (isNaN(id)) {
		throw new Error('Invalid project ID');
	}
	
	return {
		id
	};
};
