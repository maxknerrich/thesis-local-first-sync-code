// scripts/test-scenarios.ts
// Test scenarios for Use Cases 5 and 6 with rate limiting and timing controls
import * as dotenv from 'dotenv';
dotenv.config();
import {
	type Issue,
	type RateLimitState,
	checkRateLimit,
	createGraphQLClient,
	createIssue,
	createProgressTracker,
	createRateLimitState,
	delay,
	deleteIssue,
	getAllIssues,
	getExistingIssues,
	getRepoId,
	recreateRepositoryWithIssues,
	updateIssue,
	updateProgress,
	validateEnvironment
} from "./helpers.ts";

const { GITHUB_TOKEN, GITHUB_OWNER } = validateEnvironment();
const graphqlWithAuth = createGraphQLClient(GITHUB_TOKEN);
const rateLimitState = createRateLimitState();

// Helper to create issues with timing
async function createIssuesWithTiming(
	repoName: string,
	count: number,
	durationMinutes: number = 5,
	prefix: string = "Test"
) {
	console.log(`🚀 Starting to create ${count} issues in ${repoName} over ${durationMinutes} minutes`);

	const intervalMs = (durationMinutes * 60 * 1000) / count;
	const promises: Promise<any>[] = [];

	for (let i = 1; i <= count; i++) {
		const promise = (async () => {
			try {
				// Wait for the scheduled time
				await new Promise(res => setTimeout(res, intervalMs * (i - 1)));

				// Fetch repository ID fresh for EACH issue creation
				console.log(`🔍 Fetching fresh repository ID for issue ${i}...`);
				const repoId = await getRepoId(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName);

				if (!repoId) {
					throw new Error(`Repository ${repoName} not found when creating issue ${i}`);
				}

				console.log(`✅ Using fresh repository ID: ${repoId} for issue ${i}`);

				const title = `${prefix} Issue ${i} - ${new Date().toISOString()}`;
				const body = `This is ${prefix.toLowerCase()} issue number ${i} created at ${new Date().toISOString()}`;

				console.log(`📝 Creating issue ${i}/${count}: "${title}"`);

				const result = await createIssue(
					graphqlWithAuth,
					rateLimitState,
					repoId,
					title,
					body
				);

				console.log(`✅ Created issue ${i}/${count}: ${result.title}`);
				return result;
			} catch (error) {
				console.error(`❌ Failed to create issue ${i}/${count}:`, error);
				throw error;
			}
		})();

		promises.push(promise);
	}

	// Wait for all issues to be created
	try {
		const results = await Promise.allSettled(promises);
		const successful = results.filter(r => r.status === 'fulfilled').length;
		const failed = results.filter(r => r.status === 'rejected').length;

		console.log(`📊 Issue creation complete: ${successful} successful, ${failed} failed`);

		if (failed > 0) {
			console.error('Failed issue details:');
			results.forEach((result, index) => {
				if (result.status === 'rejected') {
					console.error(`Issue ${index + 1}:`, result.reason);
				}
			});
		}

		return results;
	} catch (error) {
		console.error('Error in createIssuesWithTiming:', error);
		throw error;
	}
}

// Helper to update issues with timing
async function updateIssuesWithTiming(
	repoName: string,
	count: number,
	durationMinutes: number = 5
) {
	console.log(`🔄 Starting to update ${count} issues in ${repoName} over ${durationMinutes} minutes`);

	// Fetch fresh issues list
	console.log(`🔍 Fetching fresh issues from ${repoName}...`);
	const existingIssues = count > 100
		? await getAllIssues(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName, count)
		: await getExistingIssues(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName, count);

	if (existingIssues.length < count) {
		console.warn(`⚠️ Only found ${existingIssues.length} existing issues, but need ${count} to update`);
	}

	const issuesToUpdate = existingIssues.slice(0, Math.min(count, existingIssues.length));
	const intervalMs = (durationMinutes * 60 * 1000) / issuesToUpdate.length;
	const promises: Promise<any>[] = [];

	for (let i = 0; i < issuesToUpdate.length; i++) {
		const promise = (async () => {
			try {
				// Wait for the scheduled time
				await new Promise(res => setTimeout(res, intervalMs * i));

				const issue = issuesToUpdate[i];
				const newTitle = `UPDATED: ${issue.title} - ${new Date().toISOString()}`;
				const newBody = `${issue.body}\n\nUpdated at: ${new Date().toISOString()}`;

				console.log(`🔄 Updating issue ${i + 1}/${issuesToUpdate.length}: "${issue.title}"`);

				const result = await updateIssue(
					graphqlWithAuth,
					rateLimitState,
					issue.id,
					newTitle,
					newBody
				);

				console.log(`✅ Updated issue ${i + 1}/${issuesToUpdate.length}`);
				return result;
			} catch (error) {
				console.error(`❌ Failed to update issue ${i + 1}/${issuesToUpdate.length}:`, error);
				throw error;
			}
		})();

		promises.push(promise);
	}

	// Wait for all updates to complete
	try {
		const results = await Promise.allSettled(promises);
		const successful = results.filter(r => r.status === 'fulfilled').length;
		const failed = results.filter(r => r.status === 'rejected').length;

		console.log(`📊 Issue updates complete: ${successful} successful, ${failed} failed`);

		return results;
	} catch (error) {
		console.error('Error in updateIssuesWithTiming:', error);
		throw error;
	}
}

// Helper to delete issues above a certain number
async function deleteIssuesAboveNumber(repoName: string, maxNumber: number) {
	// Use the paginated helper to get all issues
	const allIssues = await getAllIssues(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName, 300);
	const issuesToDelete = allIssues.filter(issue => issue.number > maxNumber);

	if (issuesToDelete.length === 0) {
		console.log(`No issues above #${maxNumber} to delete in ${repoName}`);
		return [];
	}

	console.log(`Deleting ${issuesToDelete.length} issues above #${maxNumber} in ${repoName}...`);

	const deletedIssues: number[] = [];

	for (const issue of issuesToDelete) {
		const success = await deleteIssue(graphqlWithAuth, rateLimitState, issue.id);

		if (success) {
			deletedIssues.push(issue.number);
			console.log(`Deleted issue #${issue.number}`);
		}
	}

	console.log(`Deleted ${deletedIssues.length} issues from ${repoName}`);
	return deletedIssues;
}

// Helper to reset issue titles and bodies to original state
async function resetIssueUpdates(repoName: string, maxNumber: number) {
	// Use a reasonable limit since we only need to check up to maxNumber + some buffer
	const maxIssues = Math.min(maxNumber + 50, 100); // Don't exceed GraphQL limit of 100
	const existingIssues = await getExistingIssues(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName, maxIssues);
	const issuesToReset = existingIssues.filter(issue =>
		issue.title.includes('UPDATED:') || issue.body.includes('--- UPDATED at')
	);

	if (issuesToReset.length === 0) {
		console.log(`No updated issues to reset in ${repoName}`);
		return [];
	}

	console.log(`Resetting ${issuesToReset.length} updated issues in ${repoName}...`);

	const resetIssues: number[] = [];

	for (const issue of issuesToReset) {
		// Remove "UPDATED:" prefix and timestamp from title
		let originalTitle = issue.title.replace(/^UPDATED: /, '').replace(/ - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, '');

		// Remove update note from body
		let originalBody = issue.body.replace(/\n\n--- UPDATED at .*? ---$/, '');

		const success = await updateIssue(graphqlWithAuth, rateLimitState, issue.id, originalTitle, originalBody);

		if (success) {
			resetIssues.push(issue.number);
			console.log(`Reset issue #${issue.number}`);
		}
	}

	console.log(`Reset ${resetIssues.length} issues in ${repoName}`);
	return resetIssues;
}

// Helper to reset repo to normal state (clean up extra issues and resets)
export async function resetRepoToNormalState(repoName: string, expectedIssueCount: number) {
	console.log(`🧹 Resetting ${repoName} to normal state (${expectedIssueCount} clean issues)...`);

	// First reset any updated issues to their original state
	await resetIssueUpdates(repoName, expectedIssueCount + 50);

	// Then delete any issues above the expected count
	await deleteIssuesAboveNumber(repoName, expectedIssueCount);

	console.log(`✅ Repository ${repoName} reset to normal state`);
}

// Helper for nuclear reset (delete and recreate repo)
export async function nuclearResetRepo(repoName: string, expectedIssueCount: number) {
	console.log(`🚨 NUCLEAR RESET: Deleting and recreating ${repoName} with ${expectedIssueCount} issues...`);

	await recreateRepositoryWithIssues(
		graphqlWithAuth,
		rateLimitState,
		GITHUB_OWNER,
		repoName,
		expectedIssueCount
	);

	console.log(`✅ Nuclear reset complete: ${repoName} recreated with ${expectedIssueCount} clean issues`);
}

// =============================================================================
// EXPORTED TEST FUNCTIONS - PARALLEL ONLY
// =============================================================================

/**
 * Use Case 5A: Create 5 issues AND update 5 existing issues in parallel over 5 minutes
 */
export async function createAndUpdate5IssuesParallel(repoName: string = "thesis-test-dynamic-5") {
	console.log("=== Use Case 5A: Creating 5 issues AND updating 5 existing issues in parallel over 5 minutes ===");
	await checkRateLimit(graphqlWithAuth, rateLimitState);

	console.log("🚀 Starting parallel create and update operations...");

	// Run both operations in parallel
	const [createdIssues, updatedIssues] = await Promise.all([
		createIssuesWithTiming(repoName, 5, 5, "UC5A-CREATE"),
		updateIssuesWithTiming(repoName, 5, 5)
	]);

	console.log("✅ Parallel operations complete:");
	console.log(`   - Created ${createdIssues.length} new issues`);
	console.log(`   - Updated ${updatedIssues.length} existing issues`);

	return {
		created: createdIssues,
		updated: updatedIssues
	};
}

/**
 * Use Case 5B: Create 25 issues AND update 25 existing issues in parallel over 5 minutes
 */
export async function createAndUpdate25IssuesParallel(repoName: string = "thesis-test-dynamic-25") {
	console.log("=== Use Case 5B: Creating 25 issues AND updating 25 existing issues in parallel over 5 minutes ===");
	await checkRateLimit(graphqlWithAuth, rateLimitState);

	console.log("🚀 Starting parallel create and update operations...");

	// Run both operations in parallel
	const [createdIssues, updatedIssues] = await Promise.all([
		createIssuesWithTiming(repoName, 25, 5, "UC5B-CREATE"),
		updateIssuesWithTiming(repoName, 25, 5)
	]);

	console.log("✅ Parallel operations complete:");
	console.log(`   - Created ${createdIssues.length} new issues`);
	console.log(`   - Updated ${updatedIssues.length} existing issues`);

	return {
		created: createdIssues,
		updated: updatedIssues
	};
}

/**
 * Use Case 6: Create 125 issues AND update 125 existing issues in parallel (fast as possible)
 */
export async function createAndUpdate125IssuesParallel(repoName: string = "thesis-test-dynamic-125") {
	console.log("=== Use Case 6: Creating 125 issues AND updating 125 existing issues in parallel (fast as possible) ===");
	await checkRateLimit(graphqlWithAuth, rateLimitState);

	console.log("🚀 Starting parallel create and update operations...");

	// For the 125 stress test, we'll run both operations in parallel
	const [createdIssues, updatedIssues] = await Promise.all([
		(async () => {
			const repoId = await getRepoId(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName);
			if (!repoId) {
				throw new Error(`Repository ${repoName} not found`);
			}

			console.log(`Creating 125 issues in ${repoName}...`);
			console.log(`Note: Each issue creation enforces a 30-second delay (GitHub 150/hour limit)`);
			console.log(`Expected duration: ~${Math.ceil(125 * 30 / 60)} minutes`);

			const createdIssues: Array<{ id: string; number: number }> = [];
			const progressTracker = createProgressTracker(125);

			for (let i = 1; i <= 125; i++) {
				const title = `UC6-CREATE Issue ${i} - ${new Date().toISOString()}`;
				const body = `This is stress test issue #${i} created at ${new Date().toISOString()}`;

				const result = await createIssue(graphqlWithAuth, rateLimitState, repoId, title, body);

				if (result) {
					createdIssues.push(result);
					updateProgress(progressTracker, `create ${i}/125 (#${result.number})`);

					// Check rate limit every 25 issues
					if (i % 25 === 0 && rateLimitState.remaining < 100) {
						console.log(`Checking rate limit after ${i} creates...`);
						await checkRateLimit(graphqlWithAuth, rateLimitState);
					}
				}
			}

			const totalTime = Math.round((Date.now() - progressTracker.startTime) / 1000);
			const avgRate = Math.round(createdIssues.length / (totalTime || 1) * 60);
			console.log(`Finished creating ${createdIssues.length} issues in ${totalTime}s (avg ${avgRate} issues/min)`);

			return createdIssues;
		})(),
		(async () => {
			const existingIssues = await getAllIssues(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName, 125);

			if (existingIssues.length < 125) {
				throw new Error(`Repository ${repoName} has only ${existingIssues.length} issues, need 125`);
			}

			console.log(`Updating 125 issues in ${repoName} as fast as possible (respecting rate limits)...`);

			const updatedIssues: Array<{ id: string; number: number }> = [];
			const progressTracker = createProgressTracker(125);

			for (let i = 0; i < 125; i++) {
				const issue = existingIssues[i];
				const newTitle = `UC6-UPDATE: ${issue.title} - ${new Date().toISOString()}`;
				const newBody = `${issue.body}\n\n--- UC6-UPDATE at ${new Date().toISOString()} ---`;

				const success = await updateIssue(graphqlWithAuth, rateLimitState, issue.id, newTitle, newBody);

				if (success) {
					updatedIssues.push({ id: issue.id, number: issue.number });
					updateProgress(progressTracker, `update ${i + 1}/125 (#${issue.number})`);

					// Check rate limit every 25 updates
					if ((i + 1) % 25 === 0 && rateLimitState.remaining < 100) {
						console.log(`Checking rate limit after ${i + 1} updates...`);
						await checkRateLimit(graphqlWithAuth, rateLimitState);
					}
				}
			}

			const totalTime = Math.round((Date.now() - progressTracker.startTime) / 1000);
			const avgRate = Math.round(updatedIssues.length / (totalTime || 1) * 60);
			console.log(`Finished updating ${updatedIssues.length} issues in ${totalTime}s (avg ${avgRate} updates/min)`);

			return updatedIssues;
		})()
	]);

	console.log("✅ Parallel stress test operations complete:");
	console.log(`   - Created ${createdIssues.length} new issues`);
	console.log(`   - Updated ${updatedIssues.length} existing issues`);

	return {
		created: createdIssues,
		updated: updatedIssues
	};
}

// =============================================================================
// FULL TEST SEQUENCE FUNCTIONS
// =============================================================================

/**
 * Run full Use Case 5 test sequence with 5 issues (parallel only)
 */
export async function runFullUseCase5Test5Issues(nuclearReset: boolean = false) {
	console.log("🧪 Starting full Use Case 5 test sequence (5 issues - parallel create+update)...");

	const results = {
		parallel: await createAndUpdate5IssuesParallel(),
		reset: nuclearReset
			? await nuclearResetRepo("thesis-test-dynamic-5", 5)
			: await resetRepoToNormalState("thesis-test-dynamic-5", 5)
	};

	console.log("✅ Use Case 5 (5 issues) test sequence complete");
	return results;
}

/**
 * Run full Use Case 5 test sequence with 25 issues (parallel only)
 */
export async function runFullUseCase5Test25Issues(nuclearReset: boolean = false) {
	console.log("🧪 Starting full Use Case 5 test sequence (25 issues - parallel create+update)...");

	const results = {
		parallel: await createAndUpdate25IssuesParallel(),
		reset: nuclearReset
			? await nuclearResetRepo("thesis-test-dynamic-25", 25)
			: await resetRepoToNormalState("thesis-test-dynamic-25", 25)
	};

	console.log("✅ Use Case 5 (25 issues) test sequence complete");
	return results;
}

/**
 * Run full Use Case 6 test sequence with 125 issues (parallel only)
 */
export async function runFullUseCase6Test125Issues(nuclearReset: boolean = false) {
	console.log("🧪 Starting full Use Case 6 test sequence (125 issues - parallel create+update)...");

	const results = {
		parallel: await createAndUpdate125IssuesParallel(),
		reset: nuclearReset
			? await nuclearResetRepo("thesis-test-dynamic-125", 125)
			: await resetRepoToNormalState("thesis-test-dynamic-125", 125)
	};

	console.log("✅ Use Case 6 (125 issues) test sequence complete");
	return results;
}

// =============================================================================
// CLI INTERFACE
// =============================================================================

// Check if this script is being run directly(not imported)
// if (process.argv[1] === import.meta.url.replace('file://', '')) {
// 	const command = process.argv[2];
// 	const repoName = process.argv[3];

// 	switch (command) {
// 		case "parallel5":
// 			await createAndUpdate5IssuesParallel(repoName);
// 			break;
// 		case "parallel25":
// 			await createAndUpdate25IssuesParallel(repoName);
// 			break;
// 		case "parallel125":
// 			await createAndUpdate125IssuesParallel(repoName);
// 			break;
// 		case "reset5":
// 			await resetRepoToNormalState(repoName || "thesis-test-dynamic-5", 5);
// 			break;
// 		case "reset25":
// 			await resetRepoToNormalState(repoName || "thesis-test-dynamic-25", 25);
// 			break;
// 		case "reset125":
// 			await resetRepoToNormalState(repoName || "thesis-test-dynamic-125", 125);
// 			break;
// 		case "nuclear5":
// 			await nuclearResetRepo(repoName || "thesis-test-dynamic-5", 5);
// 			break;
// 		case "nuclear25":
// 			await nuclearResetRepo(repoName || "thesis-test-dynamic-25", 25);
// 			break;
// 		case "nuclear125":
// 			await nuclearResetRepo(repoName || "thesis-test-dynamic-125", 125);
// 			break;
// 		case "test5":
// 			await runFullUseCase5Test5Issues();
// 			break;
// 		case "test25":
// 			await runFullUseCase5Test25Issues();
// 			break;
// 		case "test125":
// 			await runFullUseCase6Test125Issues();
// 			break;
// 		case "test5-nuclear":
// 			await runFullUseCase5Test5Issues(true);
// 			break;
// 		case "test25-nuclear":
// 			await runFullUseCase5Test25Issues(true);
// 			break;
// 		case "test125-nuclear":
// 			await runFullUseCase6Test125Issues(true);
// 			break;
// 		default:
// 			console.log(`
// Usage: bun run scripts/test-scenarios.ts <command> [repoName]

// Parallel Create+Update Commands:
//   parallel5   - Create and update 5 issues in parallel over 5 minutes
//   parallel25  - Create and update 25 issues in parallel over 5 minutes
//   parallel125 - Create and update 125 issues in parallel as fast as possible

// Reset Commands:
//   reset5      - Reset 5-issue repo to normal state (keeps issue numbering)
//   reset25     - Reset 25-issue repo to normal state (keeps issue numbering)
//   reset125    - Reset 125-issue repo to normal state (keeps issue numbering)
//   nuclear5    - 🚨 Delete & recreate 5-issue repo (clean numbering from #1)
//   nuclear25   - 🚨 Delete & recreate 25-issue repo (clean numbering from #1)
//   nuclear125  - 🚨 Delete & recreate 125-issue repo (clean numbering from #1)

// Full Test Sequences:
//   test5       - Run full Use Case 5 test (5 issues parallel) with regular reset
//   test25      - Run full Use Case 5 test (25 issues parallel) with regular reset
//   test125     - Run full Use Case 6 test (125 issues parallel) with regular reset
//   test5-nuclear   - Run full Use Case 5 test (5 issues parallel) with nuclear reset
//   test25-nuclear  - Run full Use Case 5 test (25 issues parallel) with nuclear reset  
//   test125-nuclear - Run full Use Case 6 test (125 issues parallel) with nuclear reset

// Examples:
//   bun run scripts/test-scenarios.ts parallel5        # Create+update 5 issues in parallel
//   bun run scripts/test-scenarios.ts parallel25       # Create+update 25 issues in parallel
//   bun run scripts/test-scenarios.ts nuclear5         # Clean reset for consistent numbering
//   bun run scripts/test-scenarios.ts test5-nuclear    # Full parallel test with clean reset
//       `);
// 	}
// }
