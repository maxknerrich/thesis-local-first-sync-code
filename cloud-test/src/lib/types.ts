export interface Repository {
	id: number;
	name: string;
	full_name: string;
	owner: {
		login: string;
	};
	description?: string;
}

export interface Issue {
	id: number;
	number: number;
	title: string;
	body?: string;
	state: 'open' | 'closed';
	created_at: string;
	updated_at: string;
	user: {
		login: string;
	};
}

export interface CreateIssueRequest {
	title: string;
	body?: string;
	state?: 'open' | 'closed';
}