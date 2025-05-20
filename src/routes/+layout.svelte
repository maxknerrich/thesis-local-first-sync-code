<script lang="ts">
	let { children } = $props();
</script>

<header>
	<nav>LocalIssues</nav>
</header>
<main>
	{@render children()}
</main>
