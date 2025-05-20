<script lang="ts">
	import { Issue } from "$lib/schema";

	const schema = Issue.pick("title", "description", "priority", "status");

	let form = $state({
		title: "",
		description: "",
		priority: "0",
		status: "0",
	});
</script>
