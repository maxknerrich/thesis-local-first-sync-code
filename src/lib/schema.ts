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

export function status_to_string(status: 0 | 1 | 2 | 3): string {
	switch (status) {
		case 0:
			return 'Open';
		case 1:
			return 'In Progress';
		case 2:
			return 'Closed';
		case 3:
			return 'Backlog';
		default:
			return 'Unknown';
	}
}

export function priority_to_string(priority: 0 | 1 | 2): string {
	switch (priority) {
		case 0:
			return 'Low';
		case 1:
			return 'Medium';
		case 2:
			return 'High';
		default:
			return 'Unknown';
	}
}
