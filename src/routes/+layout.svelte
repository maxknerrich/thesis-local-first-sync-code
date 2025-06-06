<script lang="ts">
	import Fps from "$lib/components/FPS.svelte";

	let { children } = $props();
</script>

<header>
	<nav>LocalIssues</nav>
</header>
<main>
	<Fps></Fps>
	{@render children()}
</main>
