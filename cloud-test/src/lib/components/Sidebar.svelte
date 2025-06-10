<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import type { Repository } from "$lib/types.js";

	let { repositories }: { repositories: Repository[] } = $props();

	let selectedRepoId = $state<number | null>(null);

	// Update selected repository based on URL
	$effect(() => {
		const { owner, repo } = $page.params;
		if (owner && repo && repositories.length > 0) {
			const repository = repositories.find(
				(r) => r.owner.login === owner && r.name === repo,
			);
			selectedRepoId = repository?.id || null;
		} else {
			selectedRepoId = null;
		}
	});

	async function selectRepository(repo: Repository) {
		selectedRepoId = repo.id;
		await goto(`/${repo.owner.login}/${repo.name}`);
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<h1>LocalIssues</h1>
	</div>

	<div class="projects-section">
		<div class="section-header">
			<h2>Projects</h2>
		</div>

		<div class="projects-list">
			{#if repositories.length === 0}
				<div class="empty">No repositories found</div>
			{:else}
				{#each repositories as repo}
					<button
						class="project-item"
						class:active={selectedRepoId === repo.id}
						onclick={() => selectRepository(repo)}
					>
						<span class="project-name">{repo.name}</span>
						<span class="project-dropdown">▼</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>
</aside>

<style>
	.sidebar {
		width: 300px;
		background: #f8f9fa;
		border-right: 1px solid #e1e4e8;
		height: 100vh;
		overflow-y: auto;
	}

	.sidebar-header {
		padding: 16px;
		border-bottom: 1px solid #e1e4e8;
	}

	.sidebar-header h1 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.projects-section {
		padding: 16px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.section-header h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #586069;
	}

	.projects-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.project-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: none;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.project-item:hover {
		background: #f3f4f6;
	}

	.project-item.active {
		background: #dbeafe;
		color: #1e40af;
	}

	.project-name {
		font-size: 14px;
		font-weight: 500;
	}

	.project-dropdown {
		font-size: 10px;
		color: #656d76;
	}

	.empty {
		padding: 12px;
		text-align: center;
		color: #656d76;
		font-size: 14px;
	}
</style>
