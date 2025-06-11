<script lang="ts">
	import { goto } from "$app/navigation";
	import IssuesHeader from "$lib/components/IssuesHeader.svelte";
	import { db } from "$lib/db";
	import {
		type Issue,
		priority_to_string,
		status_to_string,
	} from "$lib/schema";

	let { data }: { data: { projectId: number; issueId: number } } = $props();
	let issue = $state<Issue | undefined>();
	let originalIssue: Issue | undefined = $state();
	let loading = $state(true);
	let error = $state<string | undefined>();

	// Load the issue
	$effect(() => {
		loading = true;
		error = undefined;

		db.issues
			.get(data.issueId)
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

		const projectId = data.projectId;

		// Await the issue promise to get the actual issue data
		const resolvedIssue = issue;

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
			await db.issues.update(data.issueId, updates);
			// Update original issue to reflect new state
			originalIssue = { ...resolvedIssue, ...updates };
		}

		// Navigate back to the project page
		goto(`/project/${data.projectId}`);
	}

	async function deleteIssue() {
		if (confirm("Are you sure you want to delete this issue?")) {
			await db.issues.delete(data.issueId);
			goto(`/project/${data.projectId}`);
		}
	}
</script>

<IssuesHeader id={data.issueId}>
	<a href={`/project/${data.projectId}`} class="back-link">← Back</a>
</IssuesHeader>

{#if loading}
	<p>Loading...</p>
{:else if error}
	<p class="error">Error: {error}</p>
	<a href={`/project/${data.projectId}`}>Back to project</a>
{:else if issue}
	<div class="issue-container">
		<button onclick={() => deleteIssue()} class="delete-button"
			>Delete Issue</button
		>
		<form onsubmit={onSubmit}>
			<div class="content">
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
					placeholder="Issue description..."
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
				<button type="submit" class="save-button">Save & Back</button>
			</div>
		</form>
	</div>
{:else}
	<p class="error">Issue not found</p>
	<a href={`/project/${data.projectId}`}>Back to project</a>
{/if}

<style>
	.error {
		color: red;
		margin-bottom: 1rem;
	}

	.back-link {
		color: #007acc;
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.issue-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 1rem;
	}

	.delete-button {
		background-color: #dc3545;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		margin-bottom: 1rem;
	}

	.delete-button:hover {
		background-color: #c82333;
	}

	form {
		display: grid;
		grid-template-columns: 1fr 250px;
		gap: 1rem;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.title {
		width: 100%;
		padding: 0.75rem;
		font-size: 1.25rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		box-sizing: border-box;
	}

	.description {
		width: 100%;
		height: 300px;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		resize: vertical;
		box-sizing: border-box;
		font-family: inherit;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	label {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background-color: white;
	}

	.save-button {
		background-color: #007acc;
		color: white;
		border: none;
		padding: 0.75rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		margin-top: 1rem;
	}

	.save-button:hover {
		background-color: #005a9e;
	}

	@media (max-width: 768px) {
		form {
			grid-template-columns: 1fr;
		}
	}
</style>
