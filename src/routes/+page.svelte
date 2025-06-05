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
			projects: {
				mode: "manual",
				path: "r",
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

	async function Sync() {
		sync.syncTable("issues");
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
<button onclick={deleteDB}>Delete DB</button>
<button onclick={Sync}>Sync</button>
