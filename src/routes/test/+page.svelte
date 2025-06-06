<script lang="ts">
	import { db } from "$lib/db";

	import { sync } from "$lib/sync";

	let projectid: number | null = null;

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
