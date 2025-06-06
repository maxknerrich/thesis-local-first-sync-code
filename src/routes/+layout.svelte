<script lang="ts">
	import Fps from "$lib/components/FPS.svelte";

	let { children } = $props();
</script>

<header>
	<nav>
		<h1>LocalIssues</h1>
	</nav>
</header>
<main>
	<Fps height={50}></Fps>
	{@render children()}
</main>

<style>
	:global(body, html) {
		margin: 0;
		padding: 0;
		height: 100vh;
	}
	:global(body) {
		display: grid;
		grid-template-rows: 66px 1fr;
	}
	main,
	header {
		padding: 16px;
		overflow: hidden;
	}
</style>
