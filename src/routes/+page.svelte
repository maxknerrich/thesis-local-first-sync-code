<script lang="ts">
	import { PUBLIC_GITHUB_TOKEN } from "$env/static/public";
	import { db } from "$lib/db";
	import { GH_API } from "$lib/github";
	import { GitHubSync } from "$lib/sync";

	const sync = new GitHubSync({
		db,
		syncConfig: {
			issues: {
				mode: "auto",
				path: "rw",
			},
		},
	});

	async function getRepos() {
		// Get the list of repositories
		const repos = await GH_API.query.get_all_repos();
	}

	async function deleteDB() {
		await db.delete();
		localStorage.clear();
	}

	async function createProject() {
		await db.projects.add(
			{
				name: "BachelorTestProject",
				full_name: "maxknerrich/BachelorTestProject",
				description: "This is a test project for the bachelor thesis",
			},
			1,
		);
		await db.projects.add(
			{
				name: "Saturdays",
				full_name: "maxknerrich/saturdays",
				description: "This is a test project for the bachelor thesis",
			},
			1,
		);
	}

	async function Sync() {
		sync.syncTable("issues");
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
<button onclick={updateIssue}>Update issues</button>
<button onclick={getRepos}>Get Repos</button>
<button onclick={createProject}>Insert Test Project</button>
<button onclick={deleteDB}>Delete DB</button>
<button onclick={Sync}>Sync</button>
