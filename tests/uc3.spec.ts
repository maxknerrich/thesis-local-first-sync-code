import { Page, test } from "@playwright/test";
import { createAndUpdate5IssuesParallel, createAndUpdate25IssuesParallel, nuclearResetRepo } from "../scripts/test-scenarios";
import {
	APPS,
	RUNS_PER_TEST,
	getNetworkProfile
} from "./lib/constants";
import { ResultsManager, TimeSeriesLogger } from "./lib/helpers";

const manager = new ResultsManager('UC3', {
	customFields: ["syncInterval", 'GET', "POST", "PATCH", "PEAK_TTV"],
	includeTimestamp: true
});

const syncInterval = 60;


const ISSUE_COUNTS = [5, 25];

test.afterEach(async ({ page }, testInfo) => {
	//extract the issue count from the test title
	const issueCountMatch = testInfo.title.match(/ISSUE_COUNT (\d+)/);
	console.log(`Resetting repository for issue count: ${issueCountMatch[1]}`);
	await nuclearResetRepo(`thesis-test-dynamic-${issueCountMatch[1]}`, issueCountMatch[1]);
});


test.describe('UC3 - Local First', () => {
	for (let i = 1; i <= RUNS_PER_TEST; i++) {
		for (const issue_count of ISSUE_COUNTS) {
			test(`LF - UC 3 - RUN ${i} - ISSUE_COUNT ${issue_count}`, async ({
				page,
				context,
			}) => {
				const timeSeries = new TimeSeriesLogger("UC3", i, issue_count, `local-first${syncInterval}`);
				const client = await context.newCDPSession(page);

				const request = {
					GET: 0,
					POST: 0,
					PATCH: 0,
				}
				page.on("request", (res) => {
					if (!res.url().includes("api.github")) return;
					if (res.url().includes("graphql")) return;
					console.log(`>> Request sent: ${res.method()} ${res.url()}`);
					request[res.method()]++;
				});
				await client.send("Performance.enable");


				let lastTimestamp = 0;
				let lastTaskDuration = 0;

				const ttvf: number[] = [];


				await page.goto(APPS[0].use.baseURL);

				await page.waitForTimeout(2000); // Wait for the JIT compilation to finish

				const pollingInterval = setInterval(async () => {
					try {
						const { metrics: res } = await client.send("Performance.getMetrics");

						// --- RAM Calculation ---
						const jsHeapUsedSizeMetric = res.find(
							(m) => m.name === "JSHeapUsedSize"
						);

						// --- CPU Calculation ---
						const timestampMetric = res.find((m) => m.name === "Timestamp");
						const taskDurationMetric = res.find(
							(m) => m.name === "TaskDuration"
						);

						if (timestampMetric && taskDurationMetric) {
							const timestamp = timestampMetric.value;
							const taskDuration = taskDurationMetric.value;

							// We need at least two samples to calculate a delta
							if (lastTimestamp > 0) {
								const timeDelta = timestamp - lastTimestamp;
								const taskDelta = taskDuration - lastTaskDuration;
								// CPU usage is the percentage of time the main thread was busy
								const cpuUsage = (taskDelta / timeDelta) * 100;
								// @ts-ignore
								timeSeries.logSample(jsHeapUsedSizeMetric.value, cpuUsage);
							}
							lastTimestamp = timestamp;
							lastTaskDuration = taskDuration;
						}
					} catch (error) {
						console.error("Error polling metrics:", error);
					}
				}, 500);
				await page.locator('button', { hasText: 'New Project' }).waitFor({ state: 'visible' });
				await page.getByRole('button', { name: 'New Project' }).click();
				await page.getByRole('textbox', { name: 'Project Name:' }).fill('Remote');
				await page.getByText('Sync with GitHub').click();
				//wait for the sync -> Combobox should then be visible
				await page.locator('role=combobox').waitFor({ state: 'visible' });
				await page.getByRole('combobox').selectOption(`thesis-test-dynamic-${issue_count}`);
				await page.getByRole('button', { name: 'Create Project' }).click();


				await page.getByRole('link', { name: 'Remote' }).click();
				await page.waitForLoadState("networkidle");
				await page.locator("table").waitFor({ state: 'visible' });


				let remote: Promise<unknown>;

				if (issue_count === 5) {
					remote = createAndUpdate5IssuesParallel();
				} else {
					remote = createAndUpdate25IssuesParallel();
				}


				const totalDurationMs = 5 * 60 * 1000; // 5 minutes
				const startTime = Date.now();

				for (let i = issue_count; i >= 1; i--) {
					await page.getByRole('button', { name: 'Create Issue' }).click();
					await page.getByRole('textbox', { name: 'Issue Title' }).fill(`Local ${i}/${issue_count}`);
					await page.getByRole('dialog').getByRole('button', { name: 'Create Issue' }).click();
					const createStartTime = performance.now();
					await page.getByText(`Local ${i}/${issue_count}`).waitFor({ state: 'visible' });
					const createEndTime = performance.now();
					await page.goto(`http://localhost:5173/project/1/issue/${i}`)
					await page.getByRole('textbox', { name: 'Issue Title' }).click();

					const initialTitle = await page.getByRole('textbox', { name: 'Issue Title' }).inputValue();
					await page.getByRole('textbox', { name: 'Issue Title' }).fill(`LOCAL UPDATE ${initialTitle}`);
					await page.getByRole('button', { name: 'Save & Back' }).click();
					const updateStartTime = performance.now();
					await page.getByText(`LOCAL UPDATE ${initialTitle}`).waitFor({ state: "visible" });
					const updateEndTime = performance.now();

					ttvf.push(updateEndTime - updateStartTime);
					ttvf.push(createEndTime - createStartTime);
					// Calculate remaining time and adjust delay
					if (i > 1) {
						const elapsedTime = Date.now() - startTime;
						const completedIssues = issue_count - i + 1;
						const targetTime = (completedIssues / issue_count) * totalDurationMs;
						const remainingDelay = Math.max(0, targetTime - elapsedTime);
						if (remainingDelay > 0) {
							await page.waitForTimeout(remainingDelay);
						}
					}
				}

				await [remote];
				await page.waitForTimeout(syncInterval * 1000)
				// Stop polling
				clearInterval(pollingInterval);
				await client.detach();


				const peakTTVF = ttvf.reduce((max, current) => {
					return current > max ? current : max;
				}, 0);
				const lowestTTVF = ttvf.reduce((min, current) => {
					return current < min ? current : min;
				}, Number.POSITIVE_INFINITY);

				manager.addResult(
					i,
					"no", // profile name
					'local-first', // app name
					{
						syncInterval,
						GET: request.GET,
						POST: request.POST,
						PATCH: request.PATCH,
						PEAK_TTV: peakTTVF,
						LOW_TTV: lowestTTVF
					}
				)
			})
		}
	}
});
// Helper function to get API call counts from the cloud app
async function getApiCallCounts() {
	const response = await fetch('http://localhost:4173/api/call-counts');
	return await response.json();
}

// Helper function to reset API call counts
async function resetApiCallCounts() {
	await fetch('http://localhost:4173/api/call-counts', { method: 'DELETE' });
}

test.describe('UC3 - Cloud', () => {
	test.beforeEach(async () => {
		// Reset API call counters before each test
		await resetApiCallCounts();
	});
	for (let i = 1; i <= RUNS_PER_TEST; i++) {
		for (const issue_count of ISSUE_COUNTS) {
			test(`CLOUD - UC 3 - RUN ${i} - ISSUE_COUNT ${issue_count}`, async ({
				page,
				context,
			}) => {


				const timeSeries = new TimeSeriesLogger("UC3", i, issue_count, "cloud");
				const client = await context.newCDPSession(page);

				await client.send("Performance.enable");


				let lastTimestamp = 0;
				let lastTaskDuration = 0;

				const ttvf: number[] = [];


				await page.goto(APPS[1].use.baseURL);

				await page.waitForTimeout(2000); // Wait for the JIT compilation to finish

				const pollingInterval = setInterval(async () => {
					try {
						const { metrics: res } = await client.send("Performance.getMetrics");

						// --- RAM Calculation ---
						const jsHeapUsedSizeMetric = res.find(
							(m) => m.name === "JSHeapUsedSize"
						);

						// --- CPU Calculation ---
						const timestampMetric = res.find((m) => m.name === "Timestamp");
						const taskDurationMetric = res.find(
							(m) => m.name === "TaskDuration"
						);

						if (timestampMetric && taskDurationMetric) {
							const timestamp = timestampMetric.value;
							const taskDuration = taskDurationMetric.value;

							// We need at least two samples to calculate a delta
							if (lastTimestamp > 0) {
								const timeDelta = timestamp - lastTimestamp;
								const taskDelta = taskDuration - lastTaskDuration;
								// CPU usage is the percentage of time the main thread was busy
								const cpuUsage = (taskDelta / timeDelta) * 100;
								// @ts-ignore
								timeSeries.logSample(jsHeapUsedSizeMetric.value, cpuUsage);
							}
							lastTimestamp = timestamp;
							lastTaskDuration = taskDuration;
						}
					} catch (error) {
						console.error("Error polling metrics:", error);
					}
				}, 500);
				await page.goto(`http://localhost:4173/maxknerrich/thesis-test-dynamic-${issue_count}`)
				await page.waitForLoadState("networkidle")
				await page.locator("table").waitFor({ state: 'visible' });


				let remote: Promise<unknown>;

				if (issue_count === 5) {
					remote = createAndUpdate5IssuesParallel();
				} else {
					remote = createAndUpdate25IssuesParallel();
				}


				const totalDurationMs = 5 * 60 * 1000; // 5 minutes
				const startTime = Date.now();

				for (let i = issue_count; i >= 1; i--) {
					await page.getByRole('button', { name: 'Create Issue' }).click();
					await page.getByRole('textbox', { name: 'Title *' }).fill(`Local ${i}/${issue_count}`);
					await page.getByRole('dialog').getByRole('button', { name: 'Create Issue' }).click();
					const createStartTime = performance.now();
					await page.getByText(`Local ${i}/${issue_count}`).waitFor({ state: 'visible' });
					const createEndTime = performance.now();
					await page.goto(`http://localhost:4173/maxknerrich/thesis-test-dynamic-${issue_count}/issue/${i}`)
					await page.waitForLoadState("networkidle");

					const initialTitle = await page.getByRole('textbox', { name: 'Title' }).inputValue();
					await page.getByRole('textbox', { name: 'Title' }).fill(`LOCAL UPDATE ${initialTitle}`);
					await page.getByRole('button', { name: 'Save Changes' }).click();
					const updateStartTime = performance.now();
					await page.getByText(`LOCAL UPDATE ${initialTitle}`).waitFor({ state: "visible" });
					const updateEndTime = performance.now();

					ttvf.push(updateEndTime - updateStartTime);
					ttvf.push(createEndTime - createStartTime);
					// Calculate remaining time and adjust delay
					if (i > 1) {
						const elapsedTime = Date.now() - startTime;
						const completedIssues = issue_count - i + 1;
						const targetTime = (completedIssues / issue_count) * totalDurationMs;
						const remainingDelay = Math.max(0, targetTime - elapsedTime);
						if (remainingDelay > 0) {
							await page.waitForTimeout(remainingDelay);
						}
					}
				}

				await [remote];
				// Stop polling
				clearInterval(pollingInterval);
				await client.detach();


				// Get the final API call counts
				const apiCallCounts = await getApiCallCounts();

				const peakTTVF = ttvf.reduce((max, current) => {
					return current > max ? current : max;
				}, 0);
				const lowestTTVF = ttvf.reduce((min, current) => {
					return current < min ? current : min;
				}, Number.POSITIVE_INFINITY);

				manager.addResult(
					i,
					"no", // profile name
					'cloud', // app name
					{
						syncInterval,
						GET: apiCallCounts.GET,
						POST: apiCallCounts.POST,
						PATCH: apiCallCounts.PATCH,
						PEAK_TTV: peakTTVF,
						LOW_TTV: lowestTTVF
					}
				)
			})
		}
	}
});

manager.exportFinalResults();

