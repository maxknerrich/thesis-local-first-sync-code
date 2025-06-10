import { GITHUB_TOKEN } from '$env/static/private';
import { safeFetch, paginatedFetch } from '../utils.js';
import type { Repository, Issue, CreateIssueRequest } from '../types.js';

const BASE_URL = 'https://api.github.com';

const getHeaders = () => ({
	'Authorization': `Bearer ${GITHUB_TOKEN}`,
	'Accept': 'application/vnd.github.v3+json',
	'Content-Type': 'application/json'
});

export async function fetchUserRepositories() {
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
