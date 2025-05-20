<script lang="ts">
	import { db } from "$lib/db";
	import { GH_API } from "$lib/x-sync/github";

	async function addIssue() {
		// Add the new friend!
		const id = await db.issues.add({
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
		});
	}
</script>

<button onclick={addIssue}>Add issue</button>
