<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import type { Repository } from "$lib/types.js";

	let {
		dialog = $bindable(),
		selectedRepository,
	}: {
		dialog: HTMLDialogElement | undefined;
		selectedRepository: Repository | null;
	} = $props();

	let title = $state("");
	let body = $state("");
	let issueState = $state<"open" | "closed">("open");

	function handleCancel() {
		title = "";
		body = "";
		issueState = "open";
		dialog?.close();
	}
</script>

<dialog bind:this={dialog} class="create-dialog">
	<div class="dialog-content">
		<div class="dialog-header">
			<h2>Create New Issue</h2>
			<button class="close-btn" onclick={handleCancel}>×</button>
		</div>

		{#if selectedRepository}
			<form
				method="POST"
				action="?/createIssue"
				use:enhance
				onsubmit={() => {
					// Reset form and close dialog when submitting
					// (SvelteKit will handle data invalidation automatically)
					setTimeout(() => {
						title = "";
						body = "";
						issueState = "open";
						dialog?.close();
					}, 100);
				}}
			>
				<input
					type="hidden"
					name="owner"
					value={selectedRepository.owner.login}
				/>
				<input type="hidden" name="repo" value={selectedRepository.name} />

				<div class="form-group">
					<label for="title">Title *</label>
					<input
						id="title"
						name="title"
						type="text"
						bind:value={title}
						placeholder="Issue title"
						required
					/>
				</div>

				<div class="form-group">
					<label for="body">Description</label>
					<textarea
						id="body"
						name="body"
						bind:value={body}
						placeholder="Issue description"
						rows="6"
					></textarea>
				</div>

				<div class="form-group">
					<label for="state">Status</label>
					<select id="state" name="state" bind:value={issueState}>
						<option value="open">Open</option>
						<option value="closed">Closed</option>
					</select>
				</div>

				<div class="dialog-actions">
					<button type="button" onclick={handleCancel}>Cancel</button>
					<button type="submit" disabled={!title.trim()}> Create Issue </button>
				</div>
			</form>
		{:else}
			<p>Please select a repository first.</p>
		{/if}
	</div>
</dialog>

<style>
	.create-dialog {
		border: none;
		border-radius: 8px;
		padding: 0;
		max-width: 600px;
		width: 90vw;
	}

	.create-dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.dialog-content {
		padding: 24px;
	}

	.dialog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.dialog-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: #f3f4f6;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 4px;
		font-weight: 500;
		font-size: 14px;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #d0d7de;
		border-radius: 6px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.form-group textarea {
		resize: vertical;
		font-family: inherit;
	}

	.dialog-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 24px;
	}

	.dialog-actions button {
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid #d0d7de;
		background: #f6f8fa;
	}

	.dialog-actions button[type="submit"] {
		background: #2da44e;
		color: white;
		border-color: #2da44e;
	}

	.dialog-actions button:hover {
		background: #f3f4f6;
	}

	.dialog-actions button[type="submit"]:hover {
		background: #2c974b;
	}

	.dialog-actions button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
