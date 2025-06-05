<script lang="ts">
	import { PUBLIC_GITHUB_TOKEN } from "$env/static/public";
	import { db } from "$lib/db";
	import type { Issue, Project } from "$lib/schema";
	import { GitHubSync } from "$lib/x-sync";

	type Schema = {
		issues: Required<Issue>;
		repos: Required<Project>;
	};

	const sync = new GitHubSync<Schema, typeof db>({
		db,
		token: PUBLIC_GITHUB_TOKEN,
		syncConfig: {
			issues: {
				mode: "auto",
				path: "rw",
			},
			projects: {
				mode: "manual",
				path: "r",
			},
		},
		schema: {
			issues: {
				tableName: "issues",
				repos_to_fetch: () =>
					db.projects
						.filter((project) => project.active === true)
						.toArray()
						.then((result) =>
							result.map((project) => ({
								full_name: project.full_name,
								id: project.id,
							})),
						),
				getRepo: (issue) => issue.project_id,
				toLocal: (remote) => ({
					title: remote.title,
					description: remote.body,
					status: remote.state === "open" ? 0 : 2,
					github_number: remote.number,
					remote_id: remote.id,
				}),
				toRemote: (
					local,
				): Partial<{ title: string; body: string; state: string }> => {
					const remoteDelta: Partial<{
						title: string;
						body: string;
						state: string;
					}> = {};
					if (local.title) {
						remoteDelta.title = local.title;
					}
					if (local.description) {
						remoteDelta.body = local.description;
					}
					if (local.status !== undefined) {
						remoteDelta.state = local.status === 2 ? "closed" : "open";
					}
					return remoteDelta;
				},
			},
			repos: {
				tableName: "projects",
				toLocal: (remote) => ({
					name: remote.name,
					description: remote.description,
					remote_id: remote.id,
					full_name: remote.full_name,
				}),
			},
		},
	});

	async function deleteDB() {
		await db.delete();
		localStorage.clear();
	}

	async function SyncIssue() {
		sync.syncTable("issues");
	}
	async function SyncProject() {
		sync.syncTable("projects");
	}

	async function addIssue() {
		// Add the new friend!
		const id = await db.issues.add({
			title: "New Issue",
			description: `This is a new issue ${Math.random()}`,
			status: 1,
			priority: 1,
			project_id: 1,
		});
	}
	async function createProject() {
		const project = await db.projects
			.where("name")
			.equals("BachelorTestProject")
			.first();
		await db.projects.update(project?.id, {
			active: true,
		});
	}
	async function updateIssue() {
		// Add the new friend!
		await db.issues.update(1, {
			title: "local update",
		});
		await db.issues.update(2, {
			title: "local update",
			description: "local update",
		});
		await db.issues.update(1, {
			title: "local updates",
			status: 2,
		});
		await db.issues.update(1, {
			description: "local update",
		});
	}
</script>

<button onclick={addIssue}>Add issue</button>
<button onclick={createProject}>createProject </button>
<button onclick={updateIssue}>Update issues</button>
<button onclick={deleteDB}>Delete DB</button>
<button onclick={SyncIssue}>Sync Issues</button>
<button onclick={SyncProject}>Sync Projects</button>
