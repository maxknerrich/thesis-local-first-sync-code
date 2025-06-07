<script lang="ts">
	import CreateProject from "$lib/components/CreateProject.svelte";
	import { db } from "$lib/db";
	import { stateQuery } from "$lib/stateQuery.svelte";
	import { sync } from "$lib/sync";

	const projectsQuery = stateQuery(async () => await db.projects.toArray());
	const projects = $derived(projectsQuery.current ?? []);
	const activeProject = $state(projects[0] ?? null);
	let createProjectDialog = $state<HTMLDialogElement>();
</script>

<CreateProject bind:dialog={createProjectDialog} />
<grid>
	<projects>
		<button onclick={() => createProjectDialog?.showModal()}
			>Create Project</button
		>
		{#if projects.length === 0}
			<p>No active projects found.</p>
		{/if}
		{#each projects as project}
			<div class="project">
				<h2>{project.name}</h2>
				{#if activeProject === project}
					<p class="active">Active</p>
				{/if}
			</div>
		{/each}
	</projects>
	<issues> </issues>
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
</style>
