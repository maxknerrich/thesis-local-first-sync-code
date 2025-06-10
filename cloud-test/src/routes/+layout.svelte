<script lang="ts">
	import Sidebar from "$lib/components/Sidebar.svelte";
	import type { Snippet } from "svelte";

	let { children, data }: { children: Snippet; data: any } = $props();
</script>

<div class="app-layout">
	<Sidebar repositories={data.repositories} />
	<main class="main-content">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
			Helvetica, Arial, sans-serif;
		background: #ffffff;
		color: #24292f;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.app-layout {
		display: flex;
		height: 100vh;
	}

	.main-content {
		flex: 1;
		overflow-y: auto;
	}
</style>
