<script lang="ts">
	import {
		Issue,
		Priority,
		PriorityLabels,
		Status,
		StatusLabels,
	} from "$lib/schema";
	import { Button } from "$lib/shadcn/components/ui/button";
	import { Input } from "$lib/shadcn/components/ui/input/index.js";
	import Label from "$lib/shadcn/components/ui/label/label.svelte";
	import * as Select from "$lib/shadcn/components/ui/select/index.js";
	import * as Sheet from "$lib/shadcn/components/ui/sheet/index.js";
	import Textarea from "$lib/shadcn/components/ui/textarea/textarea.svelte";

	const schema = Issue.pick("title", "description", "priority", "status");

	let form = $state({
		title: "",
		description: "",
		priority: "0",
		status: "0",
	});
</script>

<Sheet.Root>
	<Sheet.Trigger>
		<Button>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mr-2"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg
			>
			New Issue
		</Button></Sheet.Trigger
	>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>Create a new Issues</Sheet.Title>
			<Sheet.Description>
				<form class="flex flex-col gap-4">
					<div>
						<Label for="title">Title</Label>
						<Input id="title" name="Issue Title" bind:value={form.title} />
					</div>
					<div>
						<Label for="description">Description</Label>
						<Textarea
							id="description"
							name="Issue Description"
							bind:value={form.description}
						/>
					</div>
					<div>
						<Label for="priority">Priority</Label>
						<Select.Root type="single" bind:value={form.priority}>
							<Select.Trigger class="w-[180px]"
								>{PriorityLabels[Number(form.priority)]}</Select.Trigger
							>
							<Select.Content>
								{#each Priority.literals as value}
									<Select.Item
										value={value.toString()}
										label={PriorityLabels[value] ?? "Unknown"}
									></Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div>
						<Label for="priority">Status</Label>
						<Select.Root type="single" bind:value={form.status}>
							<Select.Trigger class="w-[180px]"
								>{StatusLabels[Number(form.status)]}</Select.Trigger
							>
							<Select.Content>
								{#each Status.literals as value}
									<Select.Item
										value={value.toString()}
										label={StatusLabels[value] ?? "Unknown"}
									></Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<Button>Create Issue</Button>
				</form>
			</Sheet.Description>
		</Sheet.Header>
	</Sheet.Content>
</Sheet.Root>
