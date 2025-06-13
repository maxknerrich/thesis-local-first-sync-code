// scripts/helpers.ts
// Shared functionality for GitHub API operations with rate limiting
import { graphql } from "@octokit/graphql";

// Environment validation
export function validateEnvironment() {
	const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
	const GITHUB_OWNER = process.env.GITHUB_OWNER;

	if (!GITHUB_TOKEN || !GITHUB_OWNER) {
		throw new Error(
			"GITHUB_TOKEN and GITHUB_OWNER must be set in your .env file",
		);
	}

	return { GITHUB_TOKEN, GITHUB_OWNER };
}

// GraphQL client setup
export function createGraphQLClient(token: string) {
	return graphql.defaults({
		headers: {
			authorization: `token ${token}`,
		},
	});
}

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
	// Minimum delay between requests (in ms)
	MIN_DELAY: 1000, // 1 second between mutative requests as recommended
	// Delay for query requests (lower cost)
	QUERY_DELAY: 200, // 200ms between queries
	// Maximum retries for rate limit errors
	MAX_RETRIES: 5,
	// Base delay for exponential backoff (in ms)
	BASE_BACKOFF: 2000, // 2 seconds
};

// Rate limit tracking state
export interface RateLimitState {
	remaining: number;
	reset: number;  // Unix timestamp in seconds
}

// Create rate limit state
export function createRateLimitState(): RateLimitState {
	return {
		remaining: 5000, // Default assumption
		reset: 0,
	};
}

// Helper to delay execution
export function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced GraphQL wrapper with rate limiting
export async function rateLimitedGraphQL<T = any>(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	query: string,
	variables?: any,
	isMutation = false,
	retryCount = 0
): Promise<T> {
	// Check if we're close to rate limit
	if (rateLimitState.remaining < 10) {
		const waitTime = Math.max(0, rateLimitState.reset * 1000 - Date.now());
		if (waitTime > 0) {
			console.log(`Rate limit low (${rateLimitState.remaining} remaining). Waiting ${Math.round(waitTime / 1000)}s...`);
			await delay(waitTime);
		}
	}

	// Add delay between requests
	const delayTime = isMutation ? RATE_LIMIT_CONFIG.MIN_DELAY : RATE_LIMIT_CONFIG.QUERY_DELAY;
	await delay(delayTime);

	try {
		const response = await graphqlClient(query, variables);
		return response as T;
	} catch (error: any) {
		// Handle rate limit errors
		if (error.message?.includes('rate limit') || error.status === 403) {
			if (retryCount >= RATE_LIMIT_CONFIG.MAX_RETRIES) {
				throw new Error(`Rate limit exceeded after ${RATE_LIMIT_CONFIG.MAX_RETRIES} retries: ${error.message}`);
			}

			// Exponential backoff
			const backoffTime = RATE_LIMIT_CONFIG.BASE_BACKOFF * Math.pow(2, retryCount);
			console.log(`Rate limit hit. Retrying in ${backoffTime / 1000}s (attempt ${retryCount + 1}/${RATE_LIMIT_CONFIG.MAX_RETRIES})...`);
			await delay(backoffTime);

			return rateLimitedGraphQL<T>(graphqlClient, rateLimitState, query, variables, isMutation, retryCount + 1);
		}

		// Re-throw non-rate-limit errors
		throw error;
	}
}

// Helper to check current rate limit status
export async function checkRateLimit(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState
) {
	try {
		const { rateLimit } = await rateLimitedGraphQL<{ rateLimit: any }>(
			graphqlClient,
			rateLimitState,
			`query {
        rateLimit {
          limit
          remaining
          used
          resetAt
        }
      }`,
			{},
			false
		);

		rateLimitState.remaining = rateLimit.remaining;
		rateLimitState.reset = new Date(rateLimit.resetAt).getTime() / 1000;

		console.log(`Rate limit status: ${rateLimit.remaining}/${rateLimit.limit} remaining (resets at ${new Date(rateLimit.resetAt).toLocaleTimeString()})`);
		return rateLimit;
	} catch (error) {
		console.warn('Could not check rate limit status:', error);
		return null;
	}
}

// Helper to get the owner's GraphQL Node ID (cached)
let ownerIdCache: string;
export async function getOwnerId(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	ownerLogin: string
) {
	if (ownerIdCache) return ownerIdCache;

	const { user } = await rateLimitedGraphQL<{ user: { id: string } }>(
		graphqlClient,
		rateLimitState,
		`query($login: String!) { user(login: $login) { id } }`,
		{ login: ownerLogin },
		false
	);

	ownerIdCache = user.id;
	return ownerIdCache;
}

// Repository info interface
export interface RepoInfo {
	id: string;
	isPrivate: boolean;
}

// Helper to get a repository's ID and visibility
export async function getRepoInfo(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	name: string
): Promise<RepoInfo | null> {
	try {
		const { repository } = await rateLimitedGraphQL<{
			repository: { id: string; isPrivate: boolean };
		}>(
			graphqlClient,
			rateLimitState,
			`query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) { 
          id 
          isPrivate
        }
      }`,
			{ owner, name },
			false
		);
		return { id: repository.id, isPrivate: repository.isPrivate };
	} catch (error) {
		// Repository doesn't exist, return null (this is expected for new repos)
		return null;
	}
}

// Helper to get a repository's ID (backward compatibility)
export async function getRepoId(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	name: string
): Promise<string | null> {
	const repoInfo = await getRepoInfo(graphqlClient, rateLimitState, owner, name);
	return repoInfo?.id || null;
}

// Issue interface
export interface Issue {
	id: string;
	number: number;
	title: string;
	body: string;
}

// Helper to get existing issues with their numbers and IDs
export async function getExistingIssues(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	repoName: string,
	maxCount = 100
): Promise<Issue[]> {
	// GitHub GraphQL API limits to 100 records per request
	if (maxCount > 100) {
		console.warn(`Warning: GitHub GraphQL API limits to 100 records per request. Reducing maxCount from ${maxCount} to 100.`);
		maxCount = 100;
	}

	try {
		const { repository } = await rateLimitedGraphQL<{
			repository: {
				issues: {
					nodes: Issue[]
				}
			};
		}>(
			graphqlClient,
			rateLimitState,
			`query($owner: String!, $name: String!, $first: Int!) {
        repository(owner: $owner, name: $name) {
          issues(first: $first, orderBy: {field: CREATED_AT, direction: ASC}) {
            nodes {
              id
              number
              title
              body
            }
          }
        }
      }`,
			{ owner, name: repoName, first: maxCount },
			false
		);
		return repository.issues.nodes;
	} catch (error) {
		console.error(`Could not get issues for repository ${repoName}:`, error);
		return [];
	}
}

// Helper to get all issues with pagination (for large repositories)
export async function getAllIssues(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	repoName: string,
	maxTotalIssues = 300 // Safety limit
): Promise<Issue[]> {
	let allIssues: Issue[] = [];
	let hasNextPage = true;
	let cursor: string | null = null;

	console.log(`Fetching all issues from ${repoName} (paginated)...`);

	while (hasNextPage && allIssues.length < maxTotalIssues) {
		try {
			const query = cursor
				? `query($owner: String!, $name: String!, $first: Int!, $after: String!) {
            repository(owner: $owner, name: $name) {
              issues(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: ASC}) {
                nodes {
                  id
                  number
                  title
                  body
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }`
				: `query($owner: String!, $name: String!, $first: Int!) {
            repository(owner: $owner, name: $name) {
              issues(first: $first, orderBy: {field: CREATED_AT, direction: ASC}) {
                nodes {
                  id
                  number
                  title
                  body
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }`;

			const variables = cursor
				? { owner, name: repoName, first: 100, after: cursor }
				: { owner, name: repoName, first: 100 };

			const { repository } = await rateLimitedGraphQL<{
				repository: {
					issues: {
						nodes: Issue[];
						pageInfo: {
							hasNextPage: boolean;
							endCursor: string;
						}
					}
				};
			}>(
				graphqlClient,
				rateLimitState,
				query,
				variables,
				false
			);

			allIssues.push(...repository.issues.nodes);
			hasNextPage = repository.issues.pageInfo.hasNextPage;
			cursor = repository.issues.pageInfo.endCursor;

			console.log(`Fetched ${allIssues.length} issues so far...`);

		} catch (error) {
			console.error(`Error fetching issues for repository ${repoName}:`, error);
			break;
		}
	}

	console.log(`Total issues fetched: ${allIssues.length}`);
	return allIssues;
}

// Helper to get existing issue count
export async function getExistingIssueCount(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	repoName: string
): Promise<number> {
	try {
		const { repository } = await rateLimitedGraphQL<{
			repository: { issues: { totalCount: number } };
		}>(
			graphqlClient,
			rateLimitState,
			`query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          issues(first: 0) { totalCount }
        }
      }`,
			{ owner, name: repoName },
			false
		);
		return repository.issues.totalCount;
	} catch (error) {
		console.error(`Could not get issue count for repository ${repoName}.`);
		return 0;
	}
}

// Helper to create a repository (idempotent)
export async function createRepo(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	name: string
): Promise<string | null> {
	// First check if repository already exists
	const existingRepoInfo = await getRepoInfo(graphqlClient, rateLimitState, owner, name);
	if (existingRepoInfo) {
		console.log(`Repository ${owner}/${name} already exists.`);

		// Check if it's public and needs to be made private
		if (!existingRepoInfo.isPrivate) {
			console.log(`Repository ${name} is currently public, making it private...`);
			await makeRepoPrivate(owner, name, existingRepoInfo.id);
		} else {
			console.log(`Repository ${name} is already private.`);
		}

		return existingRepoInfo.id;
	}

	console.log(`Creating repository: ${owner}/${name}`);
	try {
		const ownerId = await getOwnerId(graphqlClient, rateLimitState, owner);
		const { createRepository } = await rateLimitedGraphQL<{
			createRepository: { repository: { id: string } };
		}>(
			graphqlClient,
			rateLimitState,
			`mutation($name: String!, $ownerId: ID!) {
        createRepository(input: {name: $name, visibility: PRIVATE, ownerId: $ownerId}) {
          repository { id }
        }
      }`,
			{ name, ownerId },
			true
		);
		console.log(`Repository ${name} created successfully as private.`);
		return createRepository.repository.id;
	} catch (error: any) {
		if (error.message.includes("Name already exists")) {
			console.log(`Repository ${name} already exists (caught during creation).`);
			// If repo exists, get its info and check privacy
			const repoInfo = await getRepoInfo(graphqlClient, rateLimitState, owner, name);
			if (repoInfo && !repoInfo.isPrivate) {
				console.log(`Repository ${name} is currently public, making it private...`);
				await makeRepoPrivate(owner, name, repoInfo.id);
			}
			return repoInfo?.id || null;
		} else {
			console.error(`Failed to create repo ${name}:`, error.message);
			return null;
		}
	}
}

// Helper to make a repository private using REST API
export async function makeRepoPrivate(
	owner: string,
	name: string,
	repositoryId: string
): Promise<boolean> {
	const { GITHUB_TOKEN } = validateEnvironment();
	console.log(`Making repository ${name} private via REST API...`);

	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
			method: 'PATCH',
			headers: {
				'Authorization': `token ${GITHUB_TOKEN}`,
				'Accept': 'application/vnd.github.v3+json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				private: true
			})
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorData}`);
		}

		console.log(`✅ Repository ${name} is now private.`);

		// Add a small delay to respect rate limits
		await delay(RATE_LIMIT_CONFIG.QUERY_DELAY);

		return true;
	} catch (error: any) {
		console.error(`❌ Failed to make repository ${name} private:`, error.message);
		console.warn(`   Please manually make repository '${name}' private in GitHub web interface.`);
		console.warn(`   Or use GitHub CLI: gh repo edit ${owner}/${name} --visibility private`);
		return false;
	}
}

// Helper to create a single issue with 30-second rate limiting
// GitHub allows 150 issues per hour, so we enforce 30s delay between creations
let lastIssueCreationTime = 0;
const ISSUE_CREATION_DELAY = 30000; // 30 seconds in milliseconds

export async function createIssue(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	repositoryId: string,
	title: string,
	body: string
): Promise<{ id: string; number: number } | null> {
	// Enforce 30-second delay between issue creations to respect GitHub's 150 issues/hour limit
	const now = Date.now();
	const timeSinceLastCreation = now - lastIssueCreationTime;

	if (timeSinceLastCreation < ISSUE_CREATION_DELAY) {
		const waitTime = ISSUE_CREATION_DELAY - timeSinceLastCreation;
		console.log(`Waiting ${Math.round(waitTime / 1000)}s before creating next issue (GitHub 150/hour limit)...`);
		await delay(waitTime);
	}

	try {
		const { createIssue } = await rateLimitedGraphQL<{
			createIssue: { issue: { id: string; number: number } };
		}>(
			graphqlClient,
			rateLimitState,
			`mutation($repoId: ID!, $title: String!, $body: String!) {
        createIssue(input: {repositoryId: $repoId, title: $title, body: $body}) {
          issue { id number }
        }
      }`,
			{ repoId: repositoryId, title, body },
			true
		);

		// Update the last creation time
		lastIssueCreationTime = Date.now();

		return createIssue.issue;
	} catch (error: any) {
		console.error(`Failed to create issue "${title}":`, error.message);
		return null;
	}
}

// Helper to update a single issue
export async function updateIssue(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	issueId: string,
	title: string,
	body: string
): Promise<boolean> {
	try {
		await rateLimitedGraphQL(
			graphqlClient,
			rateLimitState,
			`mutation($issueId: ID!, $title: String!, $body: String!) {
        updateIssue(input: {id: $issueId, title: $title, body: $body}) {
          issue { id number }
        }
      }`,
			{ issueId, title, body },
			true
		);
		return true;
	} catch (error: any) {
		console.error(`Failed to update issue:`, error.message);
		return false;
	}
}

// Helper to delete a single issue
export async function deleteIssue(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	issueId: string
): Promise<boolean> {
	try {
		await rateLimitedGraphQL(
			graphqlClient,
			rateLimitState,
			`mutation($issueId: ID!) { 
        deleteIssue(input: {issueId: $issueId}) { 
          clientMutationId 
        } 
      }`,
			{ issueId },
			true
		);
		return true;
	} catch (error: any) {
		console.error(`Failed to delete issue:`, error.message);
		return false;
	}
}

// Helper to add issues in bulk to a repository
export async function addIssuesToRepo(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	repoName: string,
	repositoryId: string,
	targetCount: number
): Promise<void> {
	if (!repositoryId) {
		console.error(`No repository ID provided for ${repoName}`);
		return;
	}

	// Check existing issue count
	const existingCount = await getExistingIssueCount(graphqlClient, rateLimitState, owner, repoName);

	if (existingCount >= targetCount) {
		console.log(`Repository ${repoName} already has ${existingCount} issues (target: ${targetCount}). Skipping.`);
		return;
	}

	const issuesToCreate = targetCount - existingCount;
	console.log(`Adding ${issuesToCreate} issues to ${repoName} (${existingCount} existing, ${targetCount} target)...`);

	// Add progress tracking for large batches
	const startTime = Date.now();

	for (let i = existingCount + 1; i <= targetCount; i++) {
		const title = `Issue ${i}/${targetCount} for ${repoName}`;
		const body = `This is the body for issue #${i}.`;

		const result = await createIssue(graphqlClient, rateLimitState, repositoryId, title, body);

		if (result) {
			const progress = i - existingCount;
			const percentage = Math.round((progress / issuesToCreate) * 100);
			const elapsed = Math.round((Date.now() - startTime) / 1000);
			const estimatedTotal = Math.round((elapsed / progress) * issuesToCreate);
			const remaining = Math.max(0, estimatedTotal - elapsed);

			process.stdout.write(`Created issue ${i}/${targetCount} (${percentage}%, ~${remaining}s remaining)\r`);

			// Check rate limit periodically for large batches
			if (progress % 20 === 0 && rateLimitState.remaining < 50) {
				console.log(`\nRate limit getting low during issue creation, checking status...`);
				await checkRateLimit(graphqlClient, rateLimitState);
			}
		}
	}
	console.log(`\nFinished adding issues to ${repoName}.`);
}

// Helper to delete a repository entirely using REST API
export async function deleteRepository(owner: string, name: string): Promise<boolean> {
	const { GITHUB_TOKEN } = validateEnvironment();
	console.log(`🗑️  Deleting repository ${owner}/${name}...`);

	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
			method: 'DELETE',
			headers: {
				'Authorization': `token ${GITHUB_TOKEN}`,
				'Accept': 'application/vnd.github.v3+json',
			}
		});

		if (response.status === 204) {
			console.log(`✅ Repository ${name} deleted successfully`);
			await delay(2000); // Wait 2 seconds for GitHub to process deletion
			return true;
		} else if (response.status === 404) {
			console.log(`⚠️  Repository ${name} does not exist`);
			return true; // Consider this success since the goal is achieved
		} else {
			const errorText = await response.text();
			console.error(`❌ Failed to delete repository ${name}: ${response.status} ${errorText}`);
			return false;
		}
	} catch (error: any) {
		console.error(`❌ Error deleting repository ${name}:`, error.message);
		return false;
	}
}

// Helper to recreate a repository with baseline issues (reuses add-repos logic)
export async function recreateRepositoryWithIssues(
	graphqlClient: ReturnType<typeof createGraphQLClient>,
	rateLimitState: RateLimitState,
	owner: string,
	repoName: string,
	baselineIssueCount: number
): Promise<boolean> {
	console.log(`🔄 Recreating repository ${repoName} with ${baselineIssueCount} baseline issues...`);

	// Step 1: Delete the repository
	const deleted = await deleteRepository(owner, repoName);
	if (!deleted) {
		console.error(`Cannot recreate repository ${repoName} - deletion failed`);
		return false;
	}

	// Step 2: Wait a bit more for GitHub to fully process the deletion
	console.log("⏳ Waiting for GitHub to process deletion...");
	await delay(5000); // 5 seconds wait

	// Step 3: Recreate the repository using the same logic as add-repos
	const repositoryId = await createRepo(graphqlClient, rateLimitState, owner, repoName);
	if (!repositoryId) {
		console.error(`Failed to recreate repository ${repoName}`);
		return false;
	}

	// Step 4: Add baseline issues if needed (reuses add-repos logic)
	if (baselineIssueCount > 0) {
		console.log(`📝 Adding ${baselineIssueCount} baseline issues...`);
		await addIssuesToRepo(graphqlClient, rateLimitState, owner, repoName, repositoryId, baselineIssueCount);
	}

	console.log(`✅ Repository ${repoName} recreated successfully with clean issue numbering`);
	return true;
}

// Progress tracking helper
export interface ProgressTracker {
	startTime: number;
	total: number;
	completed: number;
}

export function createProgressTracker(total: number): ProgressTracker {
	return {
		startTime: Date.now(),
		total,
		completed: 0
	};
}

export function updateProgress(tracker: ProgressTracker, itemName: string = "item"): void {
	tracker.completed++;
	const elapsed = Math.round((Date.now() - tracker.startTime) / 1000);
	const rate = Math.round(tracker.completed / (elapsed || 1) * 60); // items per minute
	const progress = Math.round((tracker.completed / tracker.total) * 100);

	console.log(`Processed ${itemName} ${tracker.completed}/${tracker.total} - ${progress}% (${elapsed}s, ~${rate}/min)`);
}
