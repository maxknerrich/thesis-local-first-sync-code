<script lang="ts">
	let { data }: { data: any } = $props();
</script>

<div class="home-page">
	<div class="welcome-section">
		<h1>Welcome to LocalIssues</h1>
		<p>Select a repository from the sidebar to view and manage its issues.</p>

		{#if data.repositories && data.repositories.length > 0}
			<div class="repositories-hint">
				<p>
					You have access to {data.repositories.length} repositories. Choose one
					to get started!
				</p>
			</div>
		{:else}
			<div class="no-repositories">
				<p>
					No repositories found. Make sure you have access to GitHub
					repositories.
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.home-page {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.welcome-section {
		text-align: center;
		max-width: 500px;
	}

	.welcome-section h1 {
		font-size: 32px;
		font-weight: 600;
		margin-bottom: 16px;
		color: #24292f;
	}

	.welcome-section p {
		font-size: 18px;
		color: #656d76;
		margin-bottom: 24px;
	}

	.repositories-hint {
		background: #dbeafe;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		padding: 16px;
		margin-top: 24px;
	}

	.repositories-hint p {
		margin: 0;
		color: #1e40af;
		font-size: 16px;
	}

	.no-repositories {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 16px;
		margin-top: 24px;
	}

	.no-repositories p {
		margin: 0;
		color: #dc2626;
		font-size: 16px;
	}
</style>
