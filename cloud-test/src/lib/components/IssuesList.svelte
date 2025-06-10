<script lang="ts">
	import type { Issue, Repository } from "$lib/types.js";

	let {
		showCreateDialog = $bindable(),
		issues,
		selectedRepository,
	}: {
		showCreateDialog: boolean;
		issues: Issue[];
		selectedRepository: Repository | null;
	} = $props();

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function getStatusBadge(state: string) {
		return state === "open" ? "Open" : "Closed";
	}
</script>

<div class="issues-container">
	{#if !selectedRepository}
		<div class="empty-state">
			<p>Select a project to view its issues.</p>
		</div>
	{:else}
		<div class="issues-header">
			<h2>Issues</h2>
			<button class="new-project-btn" onclick={() => (showCreateDialog = true)}>
				New Issue
			</button>
		</div>

		{#if issues.length === 0}
			<div class="empty-state">
				<p>No issues found for this project.</p>
			</div>
		{:else}
			<div class="issues-table">
				<table>
					<thead>
						<tr>
							<th>Status</th>
							<th>Title</th>
							<th>GitHub Nr</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{#each issues as issue}
							<tr>
								<td>
									<span
										class="status-badge"
										class:open={issue.state === "open"}
										class:closed={issue.state === "closed"}
									>
										{getStatusBadge(issue.state)}
									</span>
								</td>
								<td>
									<a
										href="/{selectedRepository.owner
											.login}/{selectedRepository.name}/issue/{issue.number}"
										class="issue-link"
									>
										{issue.title}
									</a>
								</td>
								<td>#{issue.number}</td>
								<td>{formatDate(issue.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>

<style>
	.issues-container {
		flex: 1;
		padding: 24px;
	}

	.issues-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.issues-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
	}

	.new-project-btn {
		background: #f6f8fa;
		border: 1px solid #d0d7de;
		border-radius: 6px;
		padding: 8px 16px;
		font-size: 14px;
		cursor: pointer;
		font-weight: 500;
	}

	.new-project-btn:hover {
		background: #f3f4f6;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: #656d76;
	}

	.issues-table {
		background: white;
		border: 1px solid #d0d7de;
		border-radius: 6px;
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f6f8fa;
	}

	th {
		padding: 12px 16px;
		text-align: left;
		font-weight: 600;
		font-size: 12px;
		color: #656d76;
		text-transform: uppercase;
		border-bottom: 1px solid #d0d7de;
	}

	td {
		padding: 12px 16px;
		border-bottom: 1px solid #d0d7de;
		vertical-align: middle;
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover {
		background: #f6f8fa;
	}

	.status-badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.status-badge.open {
		background: #dbeafe;
		color: #1e40af;
	}

	.status-badge.closed {
		background: #fef2f2;
		color: #dc2626;
	}

	.issue-link {
		color: #0969da;
		text-decoration: none;
		font-weight: 500;
	}

	.issue-link:hover {
		text-decoration: underline;
	}
</style>
