import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const id = parseInt(params.id);
	return {
		id,
	};
};
