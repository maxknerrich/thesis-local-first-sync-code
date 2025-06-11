import { expect, test } from "@playwright/test";
import {
	APPS,
	ISSUE_COUNTS,
	NETWORK_PROFILES,
	RUNS_PER_TEST,
	getNetworkProfile
} from "./lib/constants";
import { ResultsManager } from "./lib/helpers";


const manager = new ResultsManager('UC1', {
	customFields: ['issue_count', 'initialTTVF', 'TTVF'],
	includeTimestamp: true
});

test.describe('UC1 - Local First', () => {
	for (let i = 1; i <= RUNS_PER_TEST; i++) {
		for (const issue_count of ISSUE_COUNTS) {
			for (const profileName of Object.keys(NETWORK_PROFILES) as Array<
				keyof typeof NETWORK_PROFILES
			>) {
				test(`LF - UC 1 - RUN ${i} - ${profileName} - ${issue_count}`, async ({
					page,
					context,
				}) => {
					const profile = getNetworkProfile(profileName);
					const client = await context.newCDPSession(page);
					await client.send("Network.emulateNetworkConditions", profile);

					const metrics: Record<string, number | string> = {};

					await page.goto(APPS[0].use.baseURL);

					await page.locator('button', { hasText: 'New Project' }).waitFor({ state: 'visible' });
					await page.getByRole('button', { name: 'New Project' }).click();
					await page.getByRole('textbox', { name: 'Project Name:' }).fill('Remote');
					await page.getByText('Sync with GitHub').click();
					//wait for the sync -> Combobox should then be visible
					await page.locator('role=combobox').waitFor({ state: 'visible' });
					await page.getByRole('combobox').selectOption(`thesis-test-static-${issue_count}`);
					await page.getByRole('button', { name: 'Create Project' }).click();

					const initialStartTime = performance.now();
					await page.getByRole('link', { name: 'Remote' }).click();
					await page.locator("table").waitFor({ state: 'visible' });
					const initialEndTime = performance.now();
					await page.getByRole('button', { name: 'New Project' }).click();
					await page.getByRole('textbox', { name: 'Project Name:' }).fill('Local');
					await page.getByText('Sync with GitHub').click();
					await page.getByRole('button', { name: 'Create Project' }).click();
					await page.getByRole('link', { name: 'Local' }).click();
					await page.locator(".no-issues").waitFor({ state: 'visible' });
					const startTime = performance.now();
					await page.getByRole('link', { name: 'Remote' }).click();
					await page.locator("table").waitFor({ state: 'visible' });
					const endTime = performance.now();

					metrics.initialTTVF = initialEndTime - initialStartTime;
					metrics.TTVF = endTime - startTime;

					manager.addResult(
						i,
						profileName,
						'local-first', // app name
						{
							issue_count,
							initialTTVF: metrics.initialTTVF,
							TTVF: metrics.TTVF
						}
					)
				})
			}
		}
	}
});

test.describe('UC1 - Cloud', () => {
	for (let i = 1; i <= RUNS_PER_TEST; i++) {
		for (const issue_count of ISSUE_COUNTS) {
			for (const profileName of Object.keys(NETWORK_PROFILES) as Array<
				keyof typeof NETWORK_PROFILES
			>) {
				test(`CLOUD - UC 1 - RUN ${i} - ${profileName} - ${issue_count}`, async ({
					page,
					context,
				}) => {
					const profile = getNetworkProfile(profileName);
					const client = await context.newCDPSession(page);
					await client.send("Network.emulateNetworkConditions", profile);

					const metrics: Record<string, number | string> = {};

					await page.goto(APPS[1].use.baseURL);

					const initialStartTime = performance.now();
					await page.getByText(`thesis-test-static-${issue_count}`).click();

					await page.locator(".issues-table").waitFor({ state: 'visible' });
					const initialEndTime = performance.now();

					await page.getByText("bachelor-thesis").click();
					await page.locator(".empty-state").waitFor({ state: 'visible' });

					const startTime = performance.now();
					await page.getByText(`thesis-test-static-${issue_count}`).click();
					await page.locator(".issues-table").waitFor({ state: 'visible' });
					const endTime = performance.now();

					metrics.initialTTVF = initialEndTime - initialStartTime;
					metrics.TTVF = endTime - startTime;

					manager.addResult(
						i,
						profileName,
						'cloud',
						{
							issue_count,
							initialTTVF: metrics.initialTTVF,
							TTVF: metrics.TTVF
						}
					)
				})
			}
		}
	}
});

manager.exportFinalResults();
