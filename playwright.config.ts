// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: false, // Run tests serially to avoid resource contention
	workers: 1, // Use only one worker for the same reason
	reporter: "html",
	use: {
		trace: "on-first-retry", // Capture trace on failure
	},
	timeout: 20 * 60 * 1000, // 10 minutes in milliseconds
	// Optional: Define web servers to start automatically
	webServer: [
		{
			command: "npm run dev -- --port 5173",
			cwd: "./apps/local-first",
			url: "http://localhost:5173",
			reuseExistingServer: !process.env.CI,
		},
		{
			command: "npm run dev -- --port 4173",
			cwd: "./apps/cloud-test",
			url: "http://localhost:4173",
			reuseExistingServer: !process.env.CI,
		},
	],
});
