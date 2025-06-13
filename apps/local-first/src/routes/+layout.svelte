<script lang="ts">
	import { page } from "$app/stores";
	import CreateProject from "$lib/components/CreateProject.svelte";
	import Fps from "$lib/components/FPS.svelte";
	import { db } from "$lib/db";
	import { stateQuery } from "$lib/stateQuery.svelte";
	import { sync } from "$lib/sync";

	let { children } = $props();

	const projectsQuery = stateQuery(async () => await db.projects.toArray());
	const projects = $derived(projectsQuery.current ?? []);

	let createProjectDialog = $state<HTMLDialogElement>();

	// Get current project ID from page params
	const currentProjectId = $derived(() => {
		const params = $page.params;
		return params.id ? parseInt(params.id, 10) : null;
	});

	// Get current project from projects list
	const currentProject = $derived(() => {
		if (!currentProjectId() || !projects.length) return null;
		return projects.find((p) => p.id === currentProjectId()) || null;
	});

	$effect(() => {
		if (currentProject()) {
			document.title = `Issues - ${currentProject()?.name}`;
			if (currentProject()?.has_repository) {
				document.title += " (GitHub)";
				sync.start();
			} else {
				sync.stop();
			}
		} else {
			document.title = "Issues";
			sync.stop();
		}
	});
</script>

<header class="header">
	<h1>LocalIssues</h1>
	<Fps height={50}></Fps>
	<button onclick={() => sync.start()}>Start Sync</button>
	<button onclick={() => sync.stop()}>Stop Sync</button>
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
				<a
					href="/project/{project.id}"
					class:active={currentProjectId() === project.id}
					class="project">{project.name}</a
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
		position: relative;
		text-align: left;
	}
	.project.active {
		background-color: #f0f0f0;
		font-weight: bold;
	}
	.project:hover {
		background-color: #f0f0f0;
		cursor: pointer;
	}
</style>
