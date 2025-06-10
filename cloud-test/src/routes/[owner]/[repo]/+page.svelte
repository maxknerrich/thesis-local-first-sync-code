<script lang="ts">
	import IssuesList from "$lib/components/IssuesList.svelte";
	import CreateIssueDialog from "$lib/components/CreateIssueDialog.svelte";

	let { data }: { data: any } = $props();
	let showCreateDialog = $state(false);
	let createDialog = $state<HTMLDialogElement>();
</script>

<IssuesList
	issues={data.issues}
	selectedRepository={data.selectedRepository}
	bind:showCreateDialog
/>

<CreateIssueDialog
	bind:dialog={createDialog}
	bind:show={showCreateDialog}
	selectedRepository={data.selectedRepository}
/>
