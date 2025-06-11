<script lang="ts">
	import { db } from "$lib/db";
	import {
		type Project,
		priority_to_string,
		status_to_string,
	} from "$lib/schema";

	interface Props {
		dialog?: HTMLDialogElement | undefined;
		activeProject: Project;
	}

	let { dialog = $bindable(), activeProject }: Props = $props();

	function closeDialog() {
		dialog?.close();
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const formData = new FormData(event.target as HTMLFormElement);

		const title = formData.get("title") as string;
		const description = formData.get("description") as string;
		const status = parseInt(formData.get("status") as string, 10) as
			| 0
			| 1
			| 2
			| 3;
		const priority = parseInt(formData.get("priority") as string, 10) as
			| 0
			| 1
			| 2;

		const projectId = activeProject.id;
		await db.issues.add({
			title,
			description,
			status,
			priority,
			project_id: projectId,
		});

		closeDialog();
	}

	let statuses: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
	let prios: (0 | 1 | 2)[] = [0, 1, 2];
</script>

<dialog bind:this={dialog}>
	<div class="dialog-content">
		<form onsubmit={handleSubmit}>
			<h2>Create Issue</h2>

			<label for="title">Issue Title</label>
			<input type="text" name="title" placeholder="Issue Title" required />

			<label for="description">Description</label>
			<textarea name="description" placeholder="Issue Description"></textarea>

			<label for="status">Status</label>
			<select name="status" required>
				{#each statuses as status}
					<option value={status}>{status_to_string(status)}</option>
				{/each}
			</select>
			<label for="priority">Priority</label>
			<select name="priority" required>
				{#each prios as priority}
					<option value={priority}>{priority_to_string(priority)}</option>
				{/each}
			</select>

			<button type="submit">Create Issue</button>
		</form>
		<button onclick={closeDialog} class="close-btn">X</button>
	</div>
</dialog>

<style>
	dialog {
		border: none;
		border-radius: 8px;
		padding: 0;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		max-width: 500px;
	}

	dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.5);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.dialog-content {
		padding: 20px;
		min-width: 300px;
		position: relative;
	}

	.close-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		background: none;
		border: none;
		font-size: 20px;
		cursor: pointer;
	}
</style>
