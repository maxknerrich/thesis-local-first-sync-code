import { PUBLIC_GITHUB_TOKEN } from '$env/static/public';
import type { CreateIssueRequest, Issue, Repository } from '../types.js';
import { paginatedFetch, safeFetch } from '../utils.js';

const BASE_URL = 'https://api.github.com';

// Global API call counter for testing
export const apiCallTracker = {
	GET: 0,
	POST: 0,
	PATCH: 0,
	reset() {
		this.GET = 0;
		this.POST = 0;
		this.PATCH = 0;
	},
	getCount(method: 'GET' | 'POST' | 'PATCH') {
		return this[method];
	}
};

const getHeaders = () => ({
	'Authorization': `Bearer ${PUBLIC_GITHUB_TOKEN}`,
	'Accept': 'application/vnd.github.v3+json',
	'Content-Type': 'application/json'
});

export async function fetchUserRepositories() {
	apiCallTracker.GET++;
	console.log(`[API TRACKER] GET call made. Total GET calls: ${apiCallTracker.GET}`);

	const result = await paginatedFetch<Repository[]>(
		`${BASE_URL}/user/repos?sort=updated&per_page=100`,
		{ headers: getHeaders() }
	);

	if (result.error) {
		console.error('Error fetching repositories:', result.error);
		throw new Error('Failed to fetch repositories');
	}

	return result.data;
}

export async function fetchRepositoryIssues(owner: string, repo: string) {
	apiCallTracker.GET++;
	console.log(`[API TRACKER] GET call made. Total GET calls: ${apiCallTracker.GET}`);

	const result = await paginatedFetch<Issue[]>(
		`${BASE_URL}/repos/${owner}/${repo}/issues?state=all&per_page=100`,
		{ headers: getHeaders() }
	);

	if (result.error) {
		console.error('Error fetching issues:', result.error);
		throw new Error('Failed to fetch issues');
	}

	return result.data;
}

export async function fetchIssue(owner: string, repo: string, issueNumber: number) {
	apiCallTracker.GET++;
	console.log(`[API TRACKER] GET call made. Total GET calls: ${apiCallTracker.GET}`);

	const result = await safeFetch<Issue>(
		`${BASE_URL}/repos/${owner}/${repo}/issues/${issueNumber}`,
		{ headers: getHeaders() }
	);

	if (result.error) {
		console.error('Error fetching issue:', result.error);
		throw new Error('Failed to fetch issue');
	}

	return result.data;
}

export async function createIssue(owner: string, repo: string, issue: CreateIssueRequest) {
	apiCallTracker.POST++;
	console.log(`[API TRACKER] POST call made. Total POST calls: ${apiCallTracker.POST}`);

	const result = await safeFetch<Issue>(
		`${BASE_URL}/repos/${owner}/${repo}/issues`,
		{
			method: 'POST',
			headers: getHeaders(),
			body: JSON.stringify(issue)
		}
	);

	if (result.error) {
		console.error('Error creating issue:', result.error);
		throw new Error('Failed to create issue');
	}

	return result.data;
}

export async function updateIssue(owner: string, repo: string, issueNumber: number, updates: Partial<CreateIssueRequest>) {
	apiCallTracker.PATCH++;
	console.log(`[API TRACKER] PATCH call made. Total PATCH calls: ${apiCallTracker.PATCH}`);

	const result = await safeFetch<Issue>(
		`${BASE_URL}/repos/${owner}/${repo}/issues/${issueNumber}`,
		{
			method: 'PATCH',
			headers: getHeaders(),
			body: JSON.stringify(updates)
		}
	);

	if (result.error) {
		console.error('Error updating issue:', result.error);
		throw new Error('Failed to update issue');
	}

	return result.data;
}
