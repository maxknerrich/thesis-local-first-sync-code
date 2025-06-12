import { apiCallTracker } from '$lib/server/github.js';
import { json } from '@sveltejs/kit';

export async function GET() {
	return json({
		GET: apiCallTracker.GET,
		POST: apiCallTracker.POST,
		PATCH: apiCallTracker.PATCH
	});
}

export async function DELETE() {
	apiCallTracker.reset();
	return json({ message: 'API call counts reset' });
}
