<script lang="ts">
	import Fps from "$lib/components/FPS.svelte";

	let { children } = $props();
</script>

<header>
	<h1>LocalIssues</h1>
	<Fps height={50}></Fps>
</header>
<main>
	{@render children()}
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
	header {
		padding: 16px;
		overflow: hidden;
		margin: 0;
	}
	header {
		height: 50px;
		display: flex;
		align-items: center;
	}
</style>
