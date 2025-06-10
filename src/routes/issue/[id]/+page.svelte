<script lang="ts">
	import { goto } from "$app/navigation";
	import { activeProject } from "$lib/activeProject.svelte";
	import IssuesHeader from "$lib/components/IssuesHeader.svelte";
	import { db } from "$lib/db";
	import {
		type Issue,
		priority_to_string,
		status_to_string,
	} from "$lib/schema";

	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
	let issue = $state<Issue | undefined>();
	let originalIssue: Issue | undefined = $state();
	let loading = $state(true);
	let error = $state<string | undefined>();

	// Load the issue reactively
	$effect(() => {
		loading = true;
		error = undefined;

		db.issues
			.get(data.id)
			.then((resolvedIssue) => {
				issue = resolvedIssue;
				if (resolvedIssue && !originalIssue) {
					originalIssue = { ...resolvedIssue };
				}
				loading = false;
			})
			.catch((err) => {
				error = err.message;
				loading = false;
			});
	});

	let statuses: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
	let prios: (0 | 1 | 2)[] = [0, 1, 2];

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const formData = new FormData(event.target as HTMLFormElement);

		const title = formData.get("title") as string;
		const description =
			(formData.get("description") as string) === ""
				? undefined
				: (formData.get("description") as string);
		const status = parseInt(formData.get("status") as string, 10) as
			| 0
			| 1
			| 2
			| 3;
		const priority = parseInt(formData.get("priority") as string, 10) as
			| 0
			| 1
			| 2;

		const projectId = $state.snapshot(activeProject).value?.id ?? 0;

		// Await the issue promise to get the actual issue data
		const resolvedIssue = await issue;

		if (!resolvedIssue || !originalIssue) return;

		// Build update object with only changed fields
		const updates: Partial<typeof resolvedIssue> = {};

		if (originalIssue.title !== title) updates.title = title;
		if (originalIssue.description !== description && description)
			updates.description = description;
		if (originalIssue.status !== status) updates.status = status;
		if (originalIssue.priority !== priority) updates.priority = priority;
		if (originalIssue.project_id !== projectId) updates.project_id = projectId;

		// Only update if there are changes
		if (Object.keys(updates).length > 0) {
			await db.issues.update(data.id, updates);
			// Update original issue to reflect new state
			originalIssue = { ...resolvedIssue, ...updates };
		}
	}

	async function deleteIssue() {
		if (confirm("Are you sure you want to delete this issue?")) {
			await db.issues.delete(data.id);
			goto("/");
		}
	}
</script>

<IssuesHeader id={data.id}>
	<a href="/" class="back-link">Back</a>
</IssuesHeader>

{#await issue}
	<p>Loading...</p>
{:then issue}
	{#if issue}
		<button onclick={() => deleteIssue()}>Delete Issue</button>
		<form onsubmit={onSubmit}>
			<div>
				<input
					type="text"
					name="title"
					class="title"
					bind:value={issue.title}
					placeholder="Issue Title"
					required
				/>
				<textarea
					name="description"
					class="description"
					bind:value={issue.description}
				></textarea>
			</div>
			<div class="meta">
				<label for="status">Status</label>
				<select name="status" bind:value={issue.status}>
					{#each statuses as status}
						<option value={status}>{status_to_string(status)}</option>
					{/each}
				</select>
				<label for="priority">Priority</label>
				<select name="priority" bind:value={issue.priority}>
					{#each prios as priority}
						<option value={priority}>{priority_to_string(priority)}</option>
					{/each}
				</select>
				<button type="submit" class="save-button">Save</button>
			</div>
		</form>
	{:else}
		<p>Issue not found</p>
	{/if}
{:catch error}
	<p>Error loading issue: {error.message}</p>
{/await}

<style>
	.title {
		width: 80%;
		padding: 0.5rem;
		font-size: 1.2rem;
		margin-bottom: 1rem;
	}

	.description {
		width: 80%;
		height: 200px;
		padding: 0.5rem;
		font-size: 1rem;
	}

	form {
		display: grid;
		grid-template-columns: 1fr 200px;
	}
	input,
	textarea,
	select {
		border: 0px;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
