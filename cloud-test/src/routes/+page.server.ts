export const load = async ({ parent }) => {
	const parentData = await parent();
	return {
		repositories: parentData.repositories
	};
};
