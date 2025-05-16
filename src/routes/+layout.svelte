<script lang="ts">
	import "../app.css";
	import { Button } from "$lib/shadcn/components/ui/button";
	import { Collapsible } from "$lib/shadcn/components/ui/collapsible";
	import { Separator } from "$lib/shadcn/components/ui/separator";
	import { IsMobile } from "$lib/shadcn/hooks/is-mobile.svelte";

	export const ssr = false;

	let sidebarOpen = $state(false);

	const toggleSidebar = () => {
		sidebarOpen = !sidebarOpen;
	};

	let { children } = $props();
</script>

<div class="min-h-screen bg-background">
	<div class="grid lg:grid-cols-[250px_1fr] relative">
		<!-- Mobile header -->
		<header class="lg:hidden flex items-center justify-between p-4 border-b">
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					on:click={toggleSidebar}
					aria-label="Toggle menu"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M4 6h16"></path><path d="M4 12h16"></path><path
							d="M4 18h16"
						></path></svg
					>
				</Button>
				<span class="font-semibold">Project Name</span>
			</div>
		</header>

		<!-- Sidebar -->
		<Collapsible
			class="lg:block {sidebarOpen
				? 'absolute inset-y-0 z-20 w-full sm:w-[250px]'
				: 'hidden'} lg:relative"
			open={sidebarOpen}
		>
			<aside class="h-screen bg-background border-r overflow-y-auto">
				<div class="h-full flex flex-col gap-4 p-4">
					<!-- Desktop project name -->
					<div class="hidden lg:flex items-center gap-2 px-2">
						<div class="w-6 h-6 bg-foreground/10 rounded"></div>
						<span class="font-semibold">Localissues</span>
					</div>
					<!-- Backdrop -->
					{#if sidebarOpen && IsMobile}
						<Button
							variant="ghost"
							class="absolute top-4 right-4"
							on:click={toggleSidebar}
							aria-label="Close menu">Close Menu</Button
						>
					{/if}
					<Separator class="hidden lg:block" />

					<nav class="space-y-2">
						<Button variant="ghost" class="w-full justify-start gap-2">
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
								><path
									d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"
								></path><path d="m22 13.29-9.17 4.17a2 2 0 0 1-1.66 0L2 13.29"
								></path><path d="m22 17.29-9.17 4.17a2 2 0 0 1-1.66 0L2 17.29"
								></path></svg
							>
							Issues
						</Button>
					</nav>
				</div>
			</aside>
		</Collapsible>

		<!-- Main content -->
		<main class="min-h-screen flex flex-col">
			{@render children()}
		</main>
	</div>
</div>
