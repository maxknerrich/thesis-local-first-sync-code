<script lang="ts">
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import type { Issue } from "$lib/types.js";

	let { data }: { data: { issue: Issue } } = $props();

	let editTitle = $state(data.issue.title);
	let editBody = $state(data.issue.body || "");
	let editState = $state<"open" | "closed">(data.issue.state);

	// Update local state when data changes
	$effect(() => {
		editTitle = data.issue.title;
		editBody = data.issue.body || "";
		editState = data.issue.state;
	});

	function handleCancel() {
		editTitle = data.issue.title;
		editBody = data.issue.body || "";
		editState = data.issue.state;
	}

	async function goBack() {
		// Navigate back to the repository issues page
		const { owner, repo } = $page.params;
		await goto(`/${owner}/${repo}`);
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function getStatusBadge(state: string) {
		return state === "open" ? "Open" : "Closed";
	}
</script>

<div class="issue-page">
	<div class="issue-header">
		<div class="header-left">
			<button class="back-link" onclick={goBack}>← Back to Repository</button>
			<h1>Edit Issue #{data.issue.number}</h1>
		</div>
	</div>

	<div class="issue-content">
		<div class="issue-main">
			<form
				method="POST"
				action="?/updateIssue"
				class="edit-form"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<div class="form-group">
					<label for="title">Title</label>
					<input
						id="title"
						name="title"
						type="text"
						bind:value={editTitle}
						required
						placeholder="Issue title"
					/>
				</div>

				<div class="form-group">
					<label for="body">Description</label>
					<textarea
						id="body"
						name="body"
						bind:value={editBody}
						rows="10"
						placeholder="Issue description"
					></textarea>
				</div>

				<div class="form-group">
					<label for="state">Status</label>
					<select id="state" name="state" bind:value={editState}>
						<option value="open">Open</option>
						<option value="closed">Closed</option>
					</select>
				</div>

				<div class="form-actions">
					<button type="button" onclick={handleCancel}>Reset</button>
					<button type="submit">Save Changes</button>
				</div>
			</form>
		</div>

		<div class="issue-sidebar">
			<div class="sidebar-section">
				<h3>Status</h3>
				<span
					class="status-badge"
					class:open={data.issue.state === "open"}
					class:closed={data.issue.state === "closed"}
				>
					{getStatusBadge(data.issue.state)}
				</span>
			</div>

			<div class="sidebar-section">
				<h3>Info</h3>
				<div class="issue-meta">
					<p><strong>Created:</strong> {formatDate(data.issue.created_at)}</p>
					<p><strong>Updated:</strong> {formatDate(data.issue.updated_at)}</p>
					<p><strong>Author:</strong> {data.issue.user.login}</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.issue-page {
		padding: 24px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.issue-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid #d0d7de;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.back-link {
		color: #0969da;
		background: none;
		border: none;
		text-decoration: none;
		font-weight: 500;
		cursor: pointer;
		font-size: 16px;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.issue-header h1 {
		margin: 0;
		font-size: 24px;
		font-weight: 600;
	}

	.issue-content {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 24px;
	}

	.issue-main {
		background: white;
		border: 1px solid #d0d7de;
		border-radius: 6px;
		padding: 24px;
	}

	.issue-sidebar {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.sidebar-section {
		background: white;
		border: 1px solid #d0d7de;
		border-radius: 6px;
		padding: 16px;
	}

	.sidebar-section h3 {
		margin: 0 0 12px 0;
		font-size: 14px;
		font-weight: 600;
		color: #24292f;
	}

	.status-badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.status-badge.open {
		background: #dafbe1;
		color: #1a7f37;
	}

	.status-badge.closed {
		background: #f1c2c8;
		color: #cf222e;
	}

	.issue-meta {
		color: #656d76;
		font-size: 14px;
	}

	.issue-meta p {
		margin: 4px 0;
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-group label {
		font-weight: 500;
		font-size: 14px;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		padding: 8px 12px;
		border: 1px solid #d0d7de;
		border-radius: 6px;
		font-size: 14px;
		font-family: inherit;
	}

	.form-group textarea {
		resize: vertical;
	}

	.form-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.form-actions button {
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid #d0d7de;
		background: #f6f8fa;
	}

	.form-actions button[type="submit"] {
		background: #2da44e;
		color: white;
		border-color: #2da44e;
	}

	.form-actions button:hover {
		background: #f3f4f6;
	}

	.form-actions button[type="submit"]:hover {
		background: #2c974b;
	}
</style>
