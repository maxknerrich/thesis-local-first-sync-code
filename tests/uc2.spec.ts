import { expect, test } from "@playwright/test";
import { resetRepoToNormalState } from "../scripts/test-scenarios";
import {
	APPS,
	ISSUE_COUNTS,
	NETWORK_PROFILES,
	RUNS_PER_TEST,
	getNetworkProfile
} from "./lib/constants";
import { ResultsManager } from "./lib/helpers";


const manager = new ResultsManager('UC2', {
	customFields: ['issue_count', 'TTVF'],
	includeTimestamp: true
});

test.describe('UC2 - Local First', () => {
	for (let i = 1; i <= RUNS_PER_TEST; i++) {
		for (const issue_count of ISSUE_COUNTS) {
			for (const profileName of Object.keys(NETWORK_PROFILES) as Array<
				keyof typeof NETWORK_PROFILES
			>) {
				test(`LF - UC 2 - RUN ${i} - ${profileName} - ${issue_count}`, async ({
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
					await page.getByRole('combobox').selectOption("thesis-test-dynamic-5");
					await page.getByRole('button', { name: 'Create Project' }).click();

					await page.getByRole('link', { name: 'Remote' }).click();
					await page.locator("table").waitFor({ state: 'visible' });

					await page.getByRole('button', { name: 'Create Issue' }).click();
					await page.getByRole('textbox', { name: 'Issue Title' }).fill('Local Issue created');


					const startTime = performance.now();
					await page.getByRole('dialog').getByRole('button', { name: 'Create Issue' }).click();
					await page.getByText('Local Issue created').waitFor({ state: 'visible' });
					const endTime = performance.now();




					metrics.TTVF = endTime - startTime;


					await resetRepoToNormalState("thesis-test-dynamic-5", 5);

					manager.addResult(
						i,
						profileName,
						'local-first', // app name
						{
							issue_count,
							TTVF: metrics.TTVF
						}
					)
				})
			}
		}
	}
});

test.describe('UC2 - Cloud', () => {
	for (let i = 1; i <= RUNS_PER_TEST; i++) {
		for (const issue_count of ISSUE_COUNTS) {
			for (const profileName of Object.keys(NETWORK_PROFILES) as Array<
				keyof typeof NETWORK_PROFILES
			>) {
				test(`CLOUD - UC 2 - RUN ${i} - ${profileName} - ${issue_count}`, async ({
					page,
					context,
				}) => {
					const profile = getNetworkProfile(profileName);
					const client = await context.newCDPSession(page);
					await client.send("Network.emulateNetworkConditions", profile);

					const metrics: Record<string, number | string> = {};

					await page.goto(APPS[1].use.baseURL);

					await page.getByRole('link', { name: 'thesis-test-dynamic-5' }).click();
					await page.waitForLoadState("networkidle")

					await page.getByRole('button', { name: 'Create Issue' }).click();


					await page.getByRole('textbox', { name: 'Title *' }).fill('Local Issue created');

					const startTime = performance.now();
					await page.getByRole('dialog').getByRole('button', { name: 'Create Issue' }).click();
					await page.getByText('Local Issue created').waitFor({ state: 'visible' });
					const endTime = performance.now();

					metrics.TTVF = endTime - startTime;


					await resetRepoToNormalState("thesis-test-dynamic-5", 5);

					manager.addResult(
						i,
						profileName,
						'cloud',
						{
							issue_count,
							TTVF: metrics.TTVF
						}
					)
				})
			}
		}
	}
});

manager.exportFinalResults();
