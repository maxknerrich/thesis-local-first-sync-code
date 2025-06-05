<script lang="ts">
	import { PUBLIC_GITHUB_TOKEN } from "$env/static/public";
	import { db } from "$lib/db";
	import { GH_API } from "$lib/github";
	import { GitHubSync } from "$lib/sync";

	const BASIC_HEADERS = {
		Accept: "application/vnd.github.text+json",
		Authorization: `Bearer ${PUBLIC_GITHUB_TOKEN}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};

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
		console.log(repos);
	}

	async function deleteDB() {
		await db.delete();
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
	}

	async function Sync() {
		sync.syncTable("issues");
	}

	fetch("https://api.github.com/repos/maxknerrich/BachelorTestProject/issues", {
		method: "GET",
		headers: { ...BASIC_HEADERS },
	})
		.then((res) => res.json())
		.then((data) => {
			console.log(data);
		})
		.catch((err) => {
			console.error("Error fetching issues:", err);
		});

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
</script>

<button onclick={addIssue}>Add issue</button>
<button onclick={getRepos}>Get Repos</button>
<button onclick={createProject}>Insert Test Project</button>
<button onclick={deleteDB}>Delete DB</button>
<button onclick={Sync}>Sync</button>
