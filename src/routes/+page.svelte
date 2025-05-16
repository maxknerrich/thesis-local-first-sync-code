<script lang="ts">
	import CreateIssue from "$lib/components/CreateIssue.svelte";
	import { Button } from "$lib/shadcn/components/ui/button";
	import { Input } from "$lib/shadcn/components/ui/input";
</script>

<div class="flex-1 p-6">
	<div
		class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
	>
		<h1 class="text-2xl font-bold">Issues</h1>
		<CreateIssue />
	</div>

	<!-- Issue list -->
	<div class="rounded-lg border">
		<div class="p-4 border-b bg-muted/50">
			<div class="flex flex-col sm:flex-row gap-4">
				<Input type="text" placeholder="Filter issues..." class="max-w-sm" />
				<Button variant="outline" size="default">
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
						class="mr-2"
						><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
						></polygon></svg
					>
					Filter
				</Button>
			</div>
		</div>

		<!-- Issue items -->
		<div class="divide-y">
			{#each Array(10) as _, i (i)}
				<div
					class="p-4 hover:bg-muted/50 cursor-pointer flex items-center gap-4"
				>
					<div class="w-4 h-4 rounded-full border"></div>
					<div class="min-w-0 flex-1">
						<h3 class="font-medium truncate">Issue {i + 1}</h3>
						<p class="text-sm text-muted-foreground">Created 2 days ago</p>
					</div>
					<div class="shrink-0">
						<Button
							variant="ghost"
							size="icon"
							aria-label={"More options for Issue " + (i + 1)}
						>
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
								><circle cx="12" cy="12" r="1"></circle><circle
									cx="12"
									cy="5"
									r="1"
								></circle><circle cx="12" cy="19" r="1"></circle></svg
							>
						</Button>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
