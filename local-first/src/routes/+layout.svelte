<script lang="ts">
	import { activeProject, setActiveProject } from "$lib/activeProject.svelte";
	import CreateProject from "$lib/components/CreateProject.svelte";
	import Fps from "$lib/components/FPS.svelte";
	import { db } from "$lib/db";
	import { stateQuery } from "$lib/stateQuery.svelte";
	import { sync } from "$lib/sync";

	let { children } = $props();

	const projectsQuery = stateQuery(async () => await db.projects.toArray());
	const projects = $derived(projectsQuery.current ?? []);

	let createProjectDialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!activeProject.value && projects.length > 0) {
			setActiveProject(projects[0]);
		}
		if (activeProject.value) {
			document.title = `Issues - ${activeProject.value.name}`;
			if (activeProject.value.has_repository) {
				document.title += " (GitHub)";
				sync.start();
			} else {
				sync.stop();
			}
		} else {
			document.title = "Issues";
		}
	});
</script>

<header class="header">
	<h1>LocalIssues</h1>
	<Fps height={50}></Fps>
</header>
<main>
	<CreateProject bind:dialog={createProjectDialog} />
	<grid>
		<projects>
			<header class="projects-header">
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
					class:active={activeProject.value === project}
					class="project"
					onclick={() => setActiveProject(project)}>{project.name}</button
				>
			{/each}
		</projects>

		<issues> {@render children()}</issues>
	</grid>
</main>

<style>
	:global(body, html) {
		margin: 0;
		padding: 0;
		height: 100vh;
	}
	:global(h1, h2) {
		margin: 0;
	}
	:global(body) {
		display: grid;
		grid-template-rows: 66px 1fr;
		font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif,
			"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
	}
	main,
	.header {
		padding: 16px;
		overflow: hidden;
		margin: 0;
	}
	.header {
		height: 50px;
		display: flex;
		align-items: center;
	}
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
	.projects-header {
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
</style>
