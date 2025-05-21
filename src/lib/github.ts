import { PUBLIC_GITHUB_TOKEN } from '$env/static/public';
import type { paths } from '$lib/githubapi';
import { type TDateISO, validateISO861Date } from '$lib/types/date';
import { paginatedFetch, safeFetch } from '$lib/utils';

const BASIC_HEADERS = {
	Accept: 'application/vnd.github.text+json',
	Authorization: `Bearer ${PUBLIC_GITHUB_TOKEN}`,
	'X-GitHub-Api-Version': '2022-11-28',
};

export const GH_API = {
	query: {
		get_all_repos: async () => {
			const { data, error } = await paginatedFetch<
				paths['/users/{username}/repos']['get']['responses']['200']['content']['application/json']
			>(`https://api.github.com/user/repos`, {
				headers: BASIC_HEADERS,
			});
			if (error) {
				return { data: null, error };
			}
			return { data, error: null };
		},
		get_issues: async ({
			user,
			repo,
			since = null,
		}: {
			user: string;
			repo: string;
			since?: TDateISO | null;
		}) => {
			if (since && !validateISO861Date(since)) {
				return { data: null, error: 'Invalid date format' };
			}
			const { data, error } = await paginatedFetch<
				paths['/repos/{owner}/{repo}/issues']['get']['responses']['200']['content']['application/json']
			>(`https://api.github.com/repos/${user}/${repo}/issues`, {
				headers: since ? { ...BASIC_HEADERS, since } : BASIC_HEADERS,
			});
			if (error) {
				return { data: null, error };
			}
			return { data, error: null };
		},
	},
	push: {
		issue: {
			create: async ({
				title,
				body,
				repo,
				owner,
			}: {
				title: string;
				body: string;
				repo: string;
				owner: string;
			}) => {
				const { data, error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues']['post']['responses']['201']['content']['application/json']
				>(`https://api.github.com/repos/${owner}/${repo}/issues`, {
					method: 'POST',
					headers: BASIC_HEADERS,
					body: JSON.stringify({
						title,
						body,
					}),
				});
				if (error) {
					return { data: null, error };
				}
				return { data, error: null };
			},
			update: async ({
				issue_number,
				repo,
				owner,
				title,
				body,
			}: {
				issue_number: number;
				repo: string;
				owner: string;
				title?: string;
				body?: string;
			}) => {
				const { data, error } = await safeFetch<
					paths['/repos/{owner}/{repo}/issues/{issue_number}']['patch']['responses']['200']['content']['application/json']
				>(
					`https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`,
					{
						method: 'PATCH',
						headers: BASIC_HEADERS,
						body: JSON.stringify({
							title,
							body,
						}),
					},
				);
				if (error) {
					return { data: null, error };
				}
				return { data, error: null };
			},
		},
	},
};
