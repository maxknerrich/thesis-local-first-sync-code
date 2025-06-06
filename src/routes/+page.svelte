<script lang="ts">
	import { PUBLIC_GITHUB_TOKEN } from "$env/static/public";
	import { db } from "$lib/db";
	import type { Issue, Project } from "$lib/schema";
	import { GitHubSync } from "$lib/x-sync";

	type Schema = {
		issues: Required<Issue>;
		repos: Required<Project>;
	};

	let projectid = null;

	const sync = new GitHubSync<Schema, typeof db>({
		db,
		token: PUBLIC_GITHUB_TOKEN,
		syncConfig: {
			issues: {
				mode: "auto",
				syncInterval: 100,
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
				getRepo: (issue) =>
					db.projects.get(issue.project_id).then((repo) => repo?.full_name),
				toLocal: (remote, args: { full_name: string; id: number }) => ({
					title: remote.title,
					description: remote.body,
					status: remote.state === "open" ? 0 : 2,
					github_number: remote.number,
					remote_id: remote.id,
					project_id: args.id,
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
	}).start();

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
		if (!projectid) {
			return alert("Please create a project first!");
		}
		// Add the new friend!
		const id = await db.issues.add({
			title: "New Issue",
			description: `This is a new issue ${Math.random()}`,
			status: 1,
			priority: 1,
			project_id: projectid,
		});
	}
	async function createProject() {
		projectid = (await db.projects
			.where("name")
			.equals("BachelorTestProject")
			.first()
			.then((project) => project?.id)) as number;
		await db.projects.update(projectid, {
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
