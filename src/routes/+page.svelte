<script lang="ts">
	import { PUBLIC_GITHUB_TOKEN } from "$env/static/public";
	import { db } from "$lib/db";
	import { GH_API } from "$lib/github";
	import { mapper } from "$lib/mapper";
	import type { Issue } from "$lib/schema";

	console.log(PUBLIC_GITHUB_TOKEN);

	async function getRepos() {
		// Get the list of repositories
		const repos = await GH_API.query.get_all_repos();
		console.log(repos);
	}

	async function deleteDB() {
		await db.delete();
	}

	async function createProject() {
		await db.projects.add(
			{
				name: "BachelorTestProject",
				created_at: new Date(),
				updated_at: new Date(),
				full_name: "maxknerrich/BachelorTestProject",
				remote_created_at: new Date("2025-04-07T14:36:21Z"),
				remote_updated_at: new Date("2025-04-07T14:36:21Z"),
				remote_id: 962027710,
			},
			1,
		);
	}

	async function Sync() {
		console.log("sync started");
		const log = await db._writeLog
			.where("[object_id+table]")
			.equals([1, "issues"])
			.toArray();
		console.log(log);
		const create = log.filter((l) => l.method === "create");
		create.forEach(async (issue) => {
			if (issue.new_data === null) return;
			const data = issue.new_data as Issue;
			const moin = await mapper.api.issues?.create(data);
			await db._writeLog.delete(issue.number);
			console.log(moin);
		});
		//clear log
	}

	async function addIssue() {
		// Add the new friend!
		const id = await db.issues.add(
			{
				title: "New Issue",
				description: "This is a new issue",
				created_at: new Date(),
				updated_at: new Date(),
				status: 1,
				priority: 1,
				user: {
					id: 1,
					name: "John Doe",
					avatar_url: "https://example.com/avatar.jpg",
					login: "johndoe",
				},
				project_id: 1,
				github_number: 123,
			},
			14,
		);
	}
</script>

<button onclick={addIssue}>Add issue</button>
<button onclick={getRepos}>Get Repos</button>
<button onclick={createProject}>Insert Test Project</button>
<button onclick={deleteDB}>Delete DB</button>
<button onclick={Sync}>Sync</button>
