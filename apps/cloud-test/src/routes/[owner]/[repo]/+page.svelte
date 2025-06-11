<script lang="ts">
	import CreateIssueDialog from "$lib/components/CreateIssueDialog.svelte";
	import IssuesList from "$lib/components/IssuesList.svelte";
	import type { ActionData, PageData } from "./$types";

	const { data, form }: { data: PageData; form: ActionData } = $props();
	let showCreateDialog = $state(false);
	let createDialog = $state<HTMLDialogElement | undefined>();

	// Optimistically update issues list when a new issue is created
	const issues = $derived(() => {
		if (form?.success && form?.issue) {
			// Add the new issue to the beginning of the list
			return [form.issue, ...data.issues];
		}
		return data.issues;
	});
</script>

<IssuesList
	issues={issues()}
	selectedRepository={data.selectedRepository}
	bind:showCreateDialog
/>

<CreateIssueDialog
	bind:dialog={createDialog}
	bind:show={showCreateDialog}
	selectedRepository={data.selectedRepository}
/>
