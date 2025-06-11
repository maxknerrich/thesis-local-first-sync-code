<script lang="ts">
	import { goto } from "$app/navigation";
	import CreateIssue from "$lib/components/CreateIssue.svelte";
	import IssuesHeader from "$lib/components/IssuesHeader.svelte";
	import { db } from "$lib/db";
	import {
		type Project,
		priority_to_string,
		status_to_string,
	} from "$lib/schema";
	import { stateQuery } from "$lib/stateQuery.svelte";
	import { sync } from "$lib/sync";

	import type { PageData } from "./$types";

	let { data } = $props<{ data: PageData }>();

	let project = $state<Project | undefined>();
	let loading = $state(true);
	let error = $state<string | undefined>();

	// Load the project
	$effect(() => {
		loading = true;
		error = undefined;

		db.projects
			.get(data.id)
			.then((resolvedProject) => {
				if (!resolvedProject) {
					error = "Project not found";
					loading = false;
					return;
				}
				project = resolvedProject;
				loading = false;
			})
			.catch((err) => {
				error = err.message;
				loading = false;
			});
	});

	let issuesQuery: ReturnType<typeof stateQuery> | undefined =
		$state(undefined);
	// @ts-ignore
	let issues = $derived(issuesQuery?.current ?? []);

	$effect(() => {
		if (!project) {
			return;
		}
		issuesQuery = stateQuery(
			async () => {
				return await db.issues.where("project_id").equals(data.id).toArray();
			},
			() => [data.id],
		);
	});

	let createIssueDialog = $state<HTMLDialogElement>();
</script>

{#if loading}
	<p>Loading project...</p>
{:else if error}
	<p class="error">Error: {error}</p>
{:else if project}
	<CreateIssue bind:dialog={createIssueDialog} activeProject={project} />

	<IssuesHeader>
		<button onclick={() => sync.syncTable("issues")}>Sync</button>
		<button onclick={() => createIssueDialog?.showModal()}>Create Issue</button>
	</IssuesHeader>

	<div class="issues-container">
		{#if issues.length === 0}
			<p class="no-issues">No issues found for this project.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>Status</th>
						<th>Title</th>
						<th>Priority</th>
						{#if project.has_repository}
							<th>GitHub Nr</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each issues as issue}
						<tr>
							<td>{status_to_string(issue.status)}</td>
							<td
								><a
									href={`/project/${project.id}/issue/${issue.id}`}
									class="issue-link">{issue.title}</a
								></td
							>
							<td>{priority_to_string(issue.priority)}</td>
							{#if project.has_repository}
								<td>{issue.github_number || "-"}</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{:else}
	<p class="error">Project not found</p>
	<a href="/">Back to home</a>
{/if}

<style>
	.error {
		color: red;
		margin-bottom: 1rem;
	}

	.issues-container {
		margin-top: 1rem;
	}

	.no-issues {
		text-align: center;
		color: #666;
		margin: 2rem 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
	}

	thead {
		background-color: #f0f0f0;
	}

	th {
		padding: 12px 8px;
		text-align: left;
		border-bottom: 2px solid #ddd;
		font-weight: 600;
	}

	td {
		padding: 12px 8px;
		border-bottom: 1px solid #eee;
	}

	tr:hover {
		background-color: #f9f9f9;
	}

	.issue-link {
		color: #007acc;
		text-decoration: none;
		font-weight: 500;
	}

	.issue-link:hover {
		text-decoration: underline;
	}
</style>
