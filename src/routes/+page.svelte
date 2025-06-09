<script lang="ts">
	import CreateIssue from "$lib/components/CreateIssue.svelte";
	import CreateProject from "$lib/components/CreateProject.svelte";
	import { db } from "$lib/db";
	import {
		type Project,
		priority_to_string,
		status_to_string,
	} from "$lib/schema";
	import { stateQuery } from "$lib/stateQuery.svelte";
	import { sync } from "$lib/sync";

	const projectsQuery = stateQuery(async () => await db.projects.toArray());
	const projects = $derived(projectsQuery.current ?? []);

	// let hasSyncStarted = $state(false);

	$effect(() => {
		if (!activeProject && projects.length > 0) {
			activeProject = projects[0];
		}
		if (activeProject) {
			document.title = `Issues - ${activeProject.name}`;
			if (activeProject.has_repository) {
				document.title += " (GitHub)";
				sync.start();
			} else {
				sync.stop();
			}
		} else {
			document.title = "Issues";
		}
	});

	let issuesQuery = stateQuery(
		async () => {
			if (!activeProject) return [];
			return await db.issues
				.where("project_id")
				.equals(activeProject.id)
				.toArray();
		},
		() => [activeProject],
	);

	let issues = $derived(issuesQuery.current ?? []);

	let activeProject: Project | undefined = $state();
	let createProjectDialog = $state<HTMLDialogElement>();
	let createIssueDialog = $state<HTMLDialogElement>();
</script>

<CreateProject bind:dialog={createProjectDialog} />
{#if activeProject}
	<CreateIssue bind:dialog={createIssueDialog} {activeProject} />
{/if}
<grid>
	<projects>
		<header>
			<h2>Projects</h2>
			<button onclick={() => createProjectDialog?.showModal()}
				>New Project</button
			>
		</header>
		{#if projects.length === 0}
			<p>No active projects found.</p>
		{/if}
		{#each projects as project}
			<button
				type="button"
				class:active={activeProject === project}
				class="project"
				onclick={() => (activeProject = project)}>{project.name}</button
			>
		{/each}
	</projects>
	<issues>
		{#if !activeProject}
			<p>Select a project to view its issues.</p>
		{:else}
			<header>
				<h2>Issues</h2>
				<button onclick={() => createIssueDialog?.showModal()}
					>Create Issue</button
				>
			</header>
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
								{#if activeProject?.has_repository}
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
									{#if activeProject?.has_repository}
										<td>{issue.github_number}</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/if}
	</issues>
</grid>

<style>
	grid {
		display: grid;
		grid-template-columns: 350px 1fr;
		height: 100%;
		border: 1px solid #cfcfcf;
		border-radius: 8px;
	}
	projects {
		border-right: 1px solid #cfcfcf;
		padding: 16px;
	}
	issues {
		overflow-y: scroll;
		padding: 16px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 32px;
	}
	.project {
		display: block;
		padding: 16px;
		border-radius: 4px;
		border: 0;
		margin-bottom: 8px;
		background-color: transparent;
		width: 100%;
		position: relative;
		text-align: left;
	}
	.project.active {
		background-color: #f0f0f0;
		font-weight: bold;
	}
	.project.active::before {
		content: "•";
		position: absolute;
		right: 16px;
		color: black;
	}
	.project:hover {
		background-color: #f0f0f0;
		cursor: pointer;
	}

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
