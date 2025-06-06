export interface Issue {
	id: number;
	title: string;
	description: string;
	status: 0 | 1 | 2 | 3;
	priority: 0 | 1 | 2;
	github_number?: number;
	project_id: number;
}

export interface Project {
	id: number;
	name: string;
	description: string;
	has_repository: boolean;
	repository_id?: number;
}
export interface Repository {
	id: number;
	name: string;
	full_name: string;
	description: string;
	project_id?: number;
}
