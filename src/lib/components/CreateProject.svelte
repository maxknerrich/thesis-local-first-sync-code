<script lang="ts">
	import { db } from "$lib/db";
	import { sync } from "$lib/sync";

	interface Props {
		dialog?: HTMLDialogElement | undefined;
	}

	let promise: Promise<void> | undefined = $state();
	let { dialog = $bindable() }: Props = $props();
	let dialogElement = $state<HTMLDialogElement>();

	let isSynced = $state(false);

	// Sync the internal dialog element with the bound prop
	$effect(() => {
		if (dialogElement) {
			dialog = dialogElement;
		}
	});

	$effect(() => {
		if (isSynced) {
			promise = sync.syncTable("repositories");
		}
	});

	$effect(() => {
		promise = sync.syncTable("repositories");
	});

	function closeDialog() {
		dialogElement?.close();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const formData = new FormData(event.target as HTMLFormElement);
		const projectName = formData.get("project-name") as string;
		const description = formData.get("description") as string;
		const repositoryId = formData.get("repository") as string;

		// TODO: Add project creation logic here
		console.log("Creating project:", {
			projectName,
			description,
			repositoryId: repositoryId || null,
		});

		closeDialog();
	}
</script>

<dialog bind:this={dialogElement}>
	<div class="dialog-content">
		<form onsubmit={handleSubmit}>
			<label for="project-name">Project Name:</label>
			<input type="text" id="project-name" name="project-name" required />

			<label for="description">Description:</label>
			<textarea id="description" name="description"></textarea>

			<span>
				<input type="checkbox" id="sync" name="sync" bind:checked={isSynced} />
				<label for="sync">Sync with GitHub</label>
			</span>

			{#if isSynced}
				{#await promise}
					Syncing GitHub Repository...
				{:then}
					<label for="repository">GitHub Repository:</label>
					<select name="repository">
						<option value="" disabled selected>Select a repository</option>

						{#await db.repositories.toArray() then repositories}
							{#each repositories as repo}
								<option value={repo.id}>{repo.name}</option>
							{/each}
						{/await}
					</select>
				{/await}
			{/if}

			<button onclick={closeDialog} class="close-btn">X</button>
			<button type="submit">Create Project</button>
		</form>
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
