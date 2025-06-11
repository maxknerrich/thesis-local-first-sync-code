<script lang="ts">
	import { activeProject } from "$lib/activeProject.svelte";
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

	let issuesQuery: ReturnType<typeof stateQuery> | undefined =
		$state(undefined);
	// @ts-ignore
	let issues = $derived(issuesQuery?.current ?? []);

	$effect(() => {
		if (!activeProject.value) {
			return;
		}
		issuesQuery = stateQuery(
			async () => {
				const project = $state.snapshot(activeProject).value;
				if (!project) return [];
				return await db.issues.where("project_id").equals(project.id).toArray();
			},
			() => [activeProject],
		);
	});

	let createIssueDialog = $state<HTMLDialogElement>();
</script>

{#if activeProject}
	<CreateIssue
		bind:dialog={createIssueDialog}
		activeProject={activeProject.value as Project}
	/>
{/if}

{#if !activeProject.value}
	<p>Select a project to view its issues.</p>
{:else}
	<IssuesHeader>
		<button onclick={() => createIssueDialog?.showModal()}>Create Issue</button>
		<button onclick={() => sync.syncTable("issues")}>Sync</button>
	</IssuesHeader>
	<div>
		{#if issues.length === 0}
			<p>No issues found for this project.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>Status</th>
						<th>Title</th>
						<th>Priority</th>
						{#if activeProject.value?.has_repository}
							<th>GitHub Nr</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each issues as issue}
						<tr>
							<td>{status_to_string(issue.status)}</td>
							<td><a href={`/issue/${issue.id}`}>{issue.title}</a></td>
							<td>{priority_to_string(issue.priority)}</td>
							{#if activeProject.value?.has_repository}
								<td>{issue.github_number}</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{/if}

<style>
	table {
		width: 100%;
		border-collapse: collapse;
	}
	thead {
		background-color: #f0f0f0;
	}
	th {
		padding: 8px;
		text-align: left;
		border-bottom: 1px solid #cfcfcf;
	}
	tr {
		border-bottom: 1px solid #cfcfcf;
		height: 50px;
	}
</style>
